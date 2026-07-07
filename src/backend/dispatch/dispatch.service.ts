import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ResourcesService } from '../resources/resources.service';
import { DispatchGateway } from './dispatch.gateway';
import { DispatchStatus, NeedStatus, DriverStatus, DispatchTask, TeamDeliveryPolicy, TeamDriverAccessStatus } from '@prisma/client';
import { Role } from '../users/role.enum';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { getDistanceKm } from '../common/geo.util';

@Injectable()
export class DispatchService implements OnModuleInit {
  // Map to store last location update timestamp of drivers: driverId -> timestamp
  public driverLastUpdateMap = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private resourcesService: ResourcesService,
    @Inject(forwardRef(() => DispatchGateway))
    private dispatchGateway: DispatchGateway,
  ) {}

  private async getApprovedTeamDrivers(teamId: string) {
    const approvals = await this.prisma.teamDriverAccess.findMany({
      where: { teamId, status: TeamDriverAccessStatus.APPROVED },
      select: { driverId: true },
    });

    return new Set(approvals.map((approval) => approval.driverId));
  }

  onModuleInit() {
    // 60-second acceptance timeout loop running every 5 seconds
    setInterval(() => {
      this.checkProposalTimeouts().catch((err) => {
        console.error('Error in proposal timeout loop:', err);
      });
    }, 5000);

    // 5-minute connection loss checker running every 30 seconds
    setInterval(() => {
      this.checkConnectionTimeouts().catch((err) => {
        console.error('Error in connection timeouts checker:', err);
      });
    }, 30000);
  }

  async createDispatchTask(needId: string, targetDriverId?: string) {
    const preExistingTask = await this.prisma.dispatchTask.findFirst({
      where: {
        needId,
        status: {
          in: [
            DispatchStatus.PROPOSED,
            DispatchStatus.ACCEPTED,
            DispatchStatus.EN_ROUTE,
            DispatchStatus.ALERTA_CONEXION,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (preExistingTask) {
      return {
        success: true,
        message: 'Ya existe un despacho activo para esta necesidad.',
        task: preExistingTask,
        created: false,
      };
    }

    const need = await this.prisma.need.findUnique({
      where: { id: needId },
      include: {
        items: { include: { item: true, matchedResource: { include: { item: true } } } },
        collectionCenter: true,
        ngo: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    if (!need) {
      throw new NotFoundException('Necesidad no encontrada.');
    }

    if (need.status !== NeedStatus.PENDING) {
      throw new BadRequestException('Esta necesidad ya no está pendiente.');
    }

    // Origin point (people waiting / pickup) takes priority over destination
    const originLat = need.originLatitude ?? need.latitude;
    const originLng = need.originLongitude ?? need.longitude;
    if (originLat == null || originLng == null) {
      throw new BadRequestException('La necesidad no tiene coordenadas de origen válidas para despacho.');
    }
    const destLat = need.latitude ?? originLat;
    const destLng = need.longitude ?? originLng;
    const pickupLabel = need.originLabel ?? need.collectionCenter?.name ?? `${need.state} - ${need.sector}`;

    const attemptedDriversKey = `dispatch:${needId}:attempts`;
    const attemptedDrivers = await this.redisService.getClient().smembers(attemptedDriversKey);

    let teamId = need.ngo?.teamId ?? null;
    let teamDeliveryPolicy: TeamDeliveryPolicy | null = null;
    let approvedDrivers = new Set<string>();

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, deliveryPolicy: true },
      });

      if (team) {
        teamDeliveryPolicy = team.deliveryPolicy;
        approvedDrivers = await this.getApprovedTeamDrivers(team.id);
      } else {
        teamId = null;
      }
    }

    // Find drivers near the origin point, respecting each driver's alert radius
    const nearbyDriverIds = await this.redisService.findNearbyDrivers(originLat, originLng, 100);
    if (targetDriverId && !nearbyDriverIds.includes(targetDriverId)) {
      nearbyDriverIds.push(targetDriverId);
    }

    const eligibleDrivers: Array<{
      driverId: string;
      driverRadius: number;
      distanceKm: number;
      teamPriority: number;
    }> = [];

    for (const driverId of nearbyDriverIds) {
      if (attemptedDrivers.includes(driverId)) {
        continue;
      }

      const driverUser = await this.prisma.user.findUnique({
        where: { id: driverId },
        include: { driverDetails: true },
      });

      if (
        !driverUser ||
        !driverUser.roles.split(',').includes(Role.DRIVER) ||
        !driverUser.driverDetails ||
        driverUser.driverDetails.status !== DriverStatus.VERIFIED
      ) {
        continue;
      }

      const isTarget = driverId === targetDriverId;

      const availability = await this.redisService.getDriverAvailability(driverId);
      if (availability !== 'Disponible') {
        continue;
      }

      if (isTarget) {
        const targetActiveTask = await this.prisma.dispatchTask.findFirst({
          where: {
            driverId,
            status: {
              in: [
                DispatchStatus.PROPOSED,
                DispatchStatus.ACCEPTED,
                DispatchStatus.EN_ROUTE,
                DispatchStatus.ALERTA_CONEXION,
              ],
            },
          },
        });
        if (targetActiveTask) {
          continue;
        }
      }

      const driverRadius = driverUser.alertRadiusKm ?? 15;
      const positions = await this.redisService.getClient().geopos('drivers:locations', driverId);
      const driverPos = positions?.[0];
      if (!driverPos || driverPos[0] == null || driverPos[1] == null) {
        continue;
      }

      const driverLng = parseFloat(String(driverPos[0]));
      const driverLat = parseFloat(String(driverPos[1]));
      const distToOrigin = getDistanceKm(driverLat, driverLng, originLat, originLng);
      
      if (!isTarget && distToOrigin > driverRadius) {
        continue;
      }

      if (teamId) {
        const isTeamMember = driverUser.teamId === teamId;
        const hasApproval = approvedDrivers.has(driverId);

        if (teamDeliveryPolicy === TeamDeliveryPolicy.TEAM_ONLY) {
          if (!isTeamMember) {
            continue;
          }
        } else if (teamDeliveryPolicy === TeamDeliveryPolicy.TEAM_AND_APPROVED_EXTERNAL) {
          if (!isTeamMember && !hasApproval) {
            continue;
          }
        }

        eligibleDrivers.push({
          driverId,
          driverRadius,
          distanceKm: distToOrigin,
          teamPriority: isTeamMember ? 0 : 1,
        });
        continue;
      }

      eligibleDrivers.push({
        driverId,
        driverRadius,
        distanceKm: distToOrigin,
        teamPriority: 1,
      });
    }

    eligibleDrivers.sort((a, b) => a.teamPriority - b.teamPriority || a.distanceKm - b.distanceKm);

    let selectedDriver = eligibleDrivers[0];
    if (targetDriverId) {
      const targetDriver = eligibleDrivers.find((d) => d.driverId === targetDriverId);
      if (targetDriver) {
        selectedDriver = targetDriver;
      }
    }

    if (!selectedDriver) {
      return {
        success: false,
        message: teamId
          ? 'No se encontraron conductores aprobados para este equipo dentro del radio de alerta.'
          : 'No se encontraron conductores disponibles dentro de su radio de alerta cerca del punto de origen.',
      };
    }

    const timeoutAt = new Date();
    timeoutAt.setSeconds(timeoutAt.getSeconds() + 60);

    const taskResult = await this.prisma.$transaction(async (tx) => {
      // Lock the parent need row so only one active dispatch can be created at a time.
      await tx.$queryRaw`
        SELECT id FROM Need WHERE id = ${needId} FOR UPDATE
      `;

      const activeTask = await tx.dispatchTask.findFirst({
        where: {
          needId,
          status: {
            in: [
              DispatchStatus.PROPOSED,
              DispatchStatus.ACCEPTED,
              DispatchStatus.EN_ROUTE,
              DispatchStatus.ALERTA_CONEXION,
            ],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (activeTask) {
        return {
          success: true,
          message: 'Ya existe un despacho activo para esta necesidad.',
          task: activeTask,
          created: false,
        };
      }

      const currentNeed = await tx.need.findUnique({
        where: { id: needId },
        select: { status: true },
      });

      if (!currentNeed) {
        throw new NotFoundException('Necesidad no encontrada.');
      }

      if (currentNeed.status !== NeedStatus.PENDING) {
        throw new BadRequestException('Esta necesidad ya no está pendiente.');
      }

      const task = await tx.dispatchTask.create({
        data: {
          needId,
          driverId: selectedDriver.driverId,
          status: DispatchStatus.PROPOSED,
          timeoutAt,
          pickupLatitude: originLat,
          pickupLongitude: originLng,
          pickupLabel,
        },
      });

      return {
        success: true,
        message: 'Propuesta de despacho enviada al conductor más cercano al punto de origen.',
        task,
        created: true,
      };
    });

    if (!taskResult.created) {
      return taskResult;
    }

    await this.redisService.getClient().sadd(attemptedDriversKey, selectedDriver.driverId);
    await this.redisService.getClient().expire(attemptedDriversKey, 3600);

    const proposalKey = `dispatch:${taskResult.task.id}:proposal`;
    await this.redisService.getClient().set(proposalKey, 'PROPOSED', 'EX', 60);

    const matchedItems = need.items
      .filter((item) => item.matchedResourceId)
      .map((item) => ({
        requested: item.item.name,
        offer: item.matchedResource?.item?.name ?? item.matchedResource?.name ?? item.item.name,
        quantity: item.quantity,
        pickupLabel: item.pickupLabel,
        pickupDistanceKm: item.pickupDistanceKm,
      }));

    this.dispatchGateway.sendProposalToDriver(selectedDriver.driverId, {
      taskId: taskResult.task.id,
      description: need.description,
      timeoutSeconds: 60,
      origin: {
        latitude: originLat,
        longitude: originLng,
        label: pickupLabel,
      },
      destination: {
        latitude: destLat,
        longitude: destLng,
        label: `${need.state} - ${need.sector}`,
      },
      matchedItems,
      driverRadiusKm: selectedDriver.driverRadius,
    });

    return {
      success: true,
      message: 'Propuesta de despacho enviada al conductor más cercano al punto de origen.',
      task: taskResult.task,
    };
  }

  async acceptDispatchTask(driverId: string, taskId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Row level locking via raw MySQL select FOR UPDATE
      const tasks = await tx.$queryRaw<DispatchTask[]>`
        SELECT * FROM DispatchTask WHERE id = ${taskId} FOR UPDATE
      `;

      if (!tasks || tasks.length === 0) {
        throw new NotFoundException('Despacho no encontrado.');
      }

      const task = tasks[0];

      if (task.driverId !== driverId) {
        throw new BadRequestException('Este despacho no fue propuesto a usted.');
      }

      if (task.status !== DispatchStatus.PROPOSED) {
        throw new BadRequestException('Este despacho ya ha sido asignado a otro conductor.');
      }

      const now = new Date();
      if (now.getTime() > task.timeoutAt.getTime()) {
        // Transition to TIMED_OUT
        await tx.dispatchTask.update({
          where: { id: taskId },
          data: { status: DispatchStatus.TIMED_OUT },
        });
        throw new BadRequestException('El tiempo para aceptar este despacho ha expirado.');
      }

      // Check if Redis proposal key is still active
      const proposalKey = `dispatch:${taskId}:proposal`;
      const proposalActive = await this.redisService.getClient().exists(proposalKey);
      if (!proposalActive) {
        await tx.dispatchTask.update({
          where: { id: taskId },
          data: { status: DispatchStatus.TIMED_OUT },
        });
        throw new BadRequestException('El tiempo para aceptar este despacho ha expirado.');
      }

      // 1. Accept Task
      const updatedTask = await tx.dispatchTask.update({
        where: { id: taskId },
        data: {
          status: DispatchStatus.ACCEPTED,
          acceptedAt: now,
        },
        include: {
          need: {
            include: {
              items: { include: { item: true, matchedResource: { include: { item: true } } } },
              collectionCenter: true,
            },
          },
        },
      });

      // 2. Allocate Need
      await tx.need.update({
        where: { id: task.needId },
        data: { status: NeedStatus.ALLOCATED },
      });

      // 3. Mark Driver as busy (No Disponible) in Redis
      await this.redisService.setDriverAvailability(driverId, false);

      // Remove Redis proposal key
      await this.redisService.getClient().del(proposalKey);

      // 4. Reserve stock of matched resources only
      const needItems = await tx.needItem.findMany({
        where: { needId: task.needId, matchedResourceId: { not: null } },
      });

      if (needItems.length === 0) {
        throw new BadRequestException('No hay ítems emparejados para este despacho.');
      }

      for (const item of needItems) {
        const stockResourceId = item.matchedResourceId!;

        const resources = await tx.$queryRaw<any[]>`
          SELECT * FROM Resource WHERE id = ${stockResourceId} FOR UPDATE
        `;

        if (!resources || resources.length === 0) {
          throw new NotFoundException(`Recurso con ID ${stockResourceId} no encontrado.`);
        }

        const res = resources[0];
        if (res.stockQuantity < item.quantity) {
          throw new BadRequestException(`Stock insuficiente para el recurso: ${res.name}.`);
        }

        await tx.resource.update({
          where: { id: stockResourceId },
          data: { stockQuantity: res.stockQuantity - item.quantity },
        });

        await tx.stockTransaction.create({
          data: {
            resourceId: stockResourceId,
            quantity: -item.quantity,
            description: `Reservado y descontado para despacho ID: ${taskId}`,
          },
        });
      }

      // Initialise driver's heartbeat timestamp in gateway tracking
      this.driverLastUpdateMap.set(driverId, Date.now());

      return {
        message: 'Despacho aceptado con éxito y recursos reservados.',
        task: updatedTask,
      };
    });
  }

  async rejectDispatchTask(driverId: string, taskId: string) {
    const task = await this.prisma.dispatchTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Despacho no encontrado.');
    }

    if (task.driverId !== driverId) {
      throw new BadRequestException('Este despacho no le pertenece.');
    }

    if (task.status !== DispatchStatus.PROPOSED) {
      throw new BadRequestException('El despacho no se puede rechazar en su estado actual.');
    }

    // Update dispatch task status to CANCELLED in DB
    await this.prisma.dispatchTask.update({
      where: { id: taskId },
      data: { status: DispatchStatus.CANCELLED },
    });

    // Make driver available in Redis again
    await this.redisService.setDriverAvailability(driverId, true);

    // Delete Redis proposal key
    await this.redisService.getClient().del(`dispatch:${taskId}:proposal`);

    // Look for next nearest driver
    this.createDispatchTask(task.needId).catch((err) => {
      console.error('Error finding next driver after rejection:', err);
    });

    return {
      message: 'Despacho rechazado. Buscando otro conductor disponible.',
    };
  }

  async confirmDelivery(driverId: string, taskId: string, dto: ConfirmDeliveryDto) {
    const task = await this.prisma.dispatchTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Despacho no encontrado.');
    }

    if (task.driverId !== driverId) {
      throw new BadRequestException('Este despacho no le pertenece.');
    }

    if (task.status !== DispatchStatus.ACCEPTED && task.status !== DispatchStatus.EN_ROUTE && task.status !== DispatchStatus.ALERTA_CONEXION) {
      throw new BadRequestException('No se puede confirmar la entrega en el estado actual.');
    }

    if (!dto.signatureUrl && !dto.photoUrl) {
      throw new BadRequestException('Debe proporcionar una firma digital o una foto de entrega como prueba.');
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispatchTask.update({
        where: { id: taskId },
        data: {
          status: DispatchStatus.DELIVERED,
          signatureUrl: dto.signatureUrl,
          photoUrl: dto.photoUrl,
          updatedAt: new Date(),
        },
      });

      await tx.need.update({
        where: { id: task.needId },
        data: { status: NeedStatus.FULFILLED },
      });

      return updated;
    });

    // Free the driver
    await this.redisService.setDriverAvailability(driverId, true);
    this.driverLastUpdateMap.delete(driverId);

    // Clean up attempts list
    await this.redisService.getClient().del(`dispatch:${task.needId}:attempts`);

    return {
      message: 'Su entrega ha sido completada con éxito.',
      task: updatedTask,
    };
  }

  async checkProposalTimeouts() {
    const now = new Date();
    const activeProposals = await this.prisma.dispatchTask.findMany({
      where: {
        status: DispatchStatus.PROPOSED,
        timeoutAt: {
          lt: now,
        },
      },
    });

    for (const task of activeProposals) {
      console.log(`[TIMEOUT] Despacho ID: ${task.id} ha expirado. Revocando propuesta...`);

      await this.prisma.dispatchTask.update({
        where: { id: task.id },
        data: { status: DispatchStatus.TIMED_OUT },
      });

      // Free driver
      await this.redisService.setDriverAvailability(task.driverId, true);

      // Search for next nearest driver
      this.createDispatchTask(task.needId).catch((err) => {
        console.error('Error finding next driver after timeout:', err);
      });
    }
  }

  async checkConnectionTimeouts() {
    const now = Date.now();
    const activeDispatches = await this.prisma.dispatchTask.findMany({
      where: {
        status: {
          in: [DispatchStatus.ACCEPTED, DispatchStatus.EN_ROUTE],
        },
      },
    });

    for (const task of activeDispatches) {
      const lastUpdate = this.driverLastUpdateMap.get(task.driverId);
      if (lastUpdate && now - lastUpdate > 5 * 60 * 1000) {
        // Connection lost > 5 minutes
        console.warn(`[ALERTA] Conductor ID ${task.driverId} ha perdido la señal para despacho ID ${task.id}`);
        
        await this.prisma.dispatchTask.update({
          where: { id: task.id },
          data: { status: DispatchStatus.ALERTA_CONEXION },
        });

        // Notify operators/NGO via socket or logger
        this.dispatchGateway.notifyOperatorsConnectionLost(task.driverId, task.id);
      }
    }
  }

  registerDriverUpdate(driverId: string) {
    this.driverLastUpdateMap.set(driverId, Date.now());
  }

  async getActiveTaskForDriver(driverId: string) {
    const task = await this.prisma.dispatchTask.findFirst({
      where: {
        driverId,
        status: {
          in: [
            DispatchStatus.PROPOSED,
            DispatchStatus.ACCEPTED,
            DispatchStatus.EN_ROUTE,
            DispatchStatus.ALERTA_CONEXION,
          ],
        },
      },
      include: {
        need: {
          include: {
            items: {
              include: {
                item: true,
                matchedResource: {
                  include: {
                    item: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { task };
  }
}

