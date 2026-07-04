import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TeamDeliveryPolicy, TeamDriverAccessStatus, TeamRole } from '@prisma/client';
import { Role } from '../users/role.enum';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createTeam(creatorId: string, name: string, description?: string) {
    if (!name) {
      throw new BadRequestException('El nombre del equipo es obligatorio.');
    }

    // A user can only belong to one team at a time for simplicity
    const user = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!user) {
      throw new NotFoundException('Usuario creador no encontrado.');
    }

    if (user.teamId) {
      throw new BadRequestException('Ya eres miembro de otro equipo. Debes salir de él antes de crear uno nuevo.');
    }

    const team = await this.prisma.team.create({
      data: {
        name,
        description,
        creatorId,
      },
    });

    // Automatically join the newly created team
    await this.prisma.user.update({
      where: { id: creatorId },
      data: { teamId: team.id, teamRole: TeamRole.MANAGER },
    });

    return {
      message: 'Equipo creado con éxito.',
      team,
    };
  }

  async getAvailableTeams() {
    return this.prisma.team.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        creator: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async joinTeam(userId: string, teamId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (user.teamId) {
      throw new BadRequestException('Ya eres miembro de un equipo. Sal de él primero.');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Equipo no encontrado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId, teamRole: TeamRole.COLLABORATOR },
    });

    return {
      message: 'Te has unido al equipo con éxito.',
      team,
    };
  }

  async leaveTeam(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.teamId) {
      throw new BadRequestException('No eres miembro de ningún equipo.');
    }

    // If the creator leaves, we could delete the team or assign a new creator.
    // For simplicity, we just clear the teamId of the user. If they are the creator, they can still leave,
    // but the team remains.
    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null, shareLocationWithTeam: false, teamRole: TeamRole.COLLABORATOR },
    });

    return {
      message: 'Has salido del equipo con éxito.',
    };
  }

  async toggleLocationSharing(userId: string, share: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.teamId) {
      throw new BadRequestException('Debes unirte a un equipo antes de compartir tu ubicación.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { shareLocationWithTeam: share },
    });

    return {
      message: share 
        ? 'Ahora estás compartiendo tu ubicación en tiempo real con los miembros de tu equipo.' 
        : 'Has dejado de compartir tu ubicación con tu equipo.',
      shareLocationWithTeam: updatedUser.shareLocationWithTeam,
    };
  }

  private async getManagedTeamOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        team: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.team) {
      throw new BadRequestException('Debes pertenecer a un equipo para administrar sus ajustes.');
    }

    const isManager = user.teamRole === TeamRole.MANAGER || user.team.creatorId === user.id;
    if (!isManager) {
      throw new BadRequestException('Solo el creador o un gerente del equipo puede administrar estos ajustes.');
    }

    return { user, team: user.team };
  }

  private async getDriverUserOrThrow(driverId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException('Conductor no encontrado.');
    }

    if (!driver.roles.split(',').includes(Role.DRIVER)) {
      throw new BadRequestException('El usuario indicado no tiene rol de conductor.');
    }

    return driver;
  }

  async updateMyTeamSettings(
    userId: string,
    payload: { name?: string; description?: string; deliveryPolicy?: TeamDeliveryPolicy },
  ) {
    const { team } = await this.getManagedTeamOrThrow(userId);

    if (!payload.name && payload.description === undefined && !payload.deliveryPolicy) {
      throw new BadRequestException('Debe enviar al menos un campo para actualizar.');
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id: team.id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.deliveryPolicy ? { deliveryPolicy: payload.deliveryPolicy } : {}),
      },
    });

    return {
      message: 'Ajustes del equipo actualizados con éxito.',
      team: updatedTeam,
    };
  }

  async getMyTeamSettings(userId: string) {
    const { user, team } = await this.getManagedTeamOrThrow(userId);

    const teamWithSettings = await this.prisma.team.findUnique({
      where: { id: team.id },
      include: {
        members: {
          select: {
            id: true,
            name: true,
            roles: true,
            teamRole: true,
            shareLocationWithTeam: true,
          },
        },
        driverAccessRequests: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                roles: true,
                teamId: true,
                teamRole: true,
              },
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!teamWithSettings) {
      throw new NotFoundException('Equipo no encontrado.');
    }

    const membersWithLocations = await Promise.all(
      teamWithSettings.members.map(async (member) => {
        let location = null;
        if (member.shareLocationWithTeam) {
          location = await this.redisService.getUserLocation(member.id);
        }
        return {
          ...member,
          location,
        };
      }),
    );

    return {
      inTeam: true,
      team: {
        id: teamWithSettings.id,
        name: teamWithSettings.name,
        description: teamWithSettings.description,
        creatorId: teamWithSettings.creatorId,
        deliveryPolicy: teamWithSettings.deliveryPolicy,
        members: membersWithLocations,
        driverAccessRequests: teamWithSettings.driverAccessRequests,
      },
      shareLocationWithTeam: user.shareLocationWithTeam,
    };
  }

  async getMyTeamDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        team: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                roles: true,
                teamRole: true,
                shareLocationWithTeam: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.team) {
      return { inTeam: false };
    }

    const membersWithLocations = await Promise.all(
      user.team.members.map(async (member) => {
        let location = null;
        if (member.shareLocationWithTeam) {
          location = await this.redisService.getUserLocation(member.id);
        }
        return {
          ...member,
          location,
        };
      }),
    );

    return {
      inTeam: true,
      team: {
        id: user.team.id,
        name: user.team.name,
        description: user.team.description,
        creatorId: user.team.creatorId,
        members: membersWithLocations,
      },
      shareLocationWithTeam: user.shareLocationWithTeam,
    };
  }

  async requestDriverAccess(userId: string, teamId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { team: true },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.roles.split(',').includes('DRIVER')) {
      throw new BadRequestException('Solo los conductores pueden solicitar acceso de despacho al equipo.');
    }

    const targetTeamId = teamId ?? user.teamId;
    if (!targetTeamId) {
      throw new BadRequestException('Debe indicar un equipo para solicitar acceso.');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: targetTeamId },
    });

    if (!team) {
      throw new NotFoundException('Equipo no encontrado.');
    }

    const access = await this.prisma.teamDriverAccess.upsert({
      where: {
        teamId_driverId: {
          teamId: targetTeamId,
          driverId: userId,
        },
      },
      create: {
        teamId: targetTeamId,
        driverId: userId,
        status: TeamDriverAccessStatus.PENDING,
      },
      update: {
        status: TeamDriverAccessStatus.PENDING,
        approvedById: null,
      },
    });

    return {
      message: 'Solicitud de acceso enviada al equipo.',
      access,
    };
  }

  async listPendingDriverAccess(userId: string) {
    const { team } = await this.getManagedTeamOrThrow(userId);

    const requests = await this.prisma.teamDriverAccess.findMany({
      where: { teamId: team.id, status: TeamDriverAccessStatus.PENDING },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            roles: true,
            teamId: true,
            teamRole: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      teamId: team.id,
      requests,
    };
  }

  async approveDriverAccess(userId: string, driverId: string) {
    const { user, team } = await this.getManagedTeamOrThrow(userId);
    await this.getDriverUserOrThrow(driverId);

    const access = await this.prisma.teamDriverAccess.upsert({
      where: {
        teamId_driverId: {
          teamId: team.id,
          driverId,
        },
      },
      create: {
        teamId: team.id,
        driverId,
        status: TeamDriverAccessStatus.APPROVED,
        approvedById: user.id,
      },
      update: {
        status: TeamDriverAccessStatus.APPROVED,
        approvedById: user.id,
      },
    });

    return {
      message: 'El conductor fue aprobado para este equipo.',
      access,
    };
  }

  async rejectDriverAccess(userId: string, driverId: string) {
    const { user, team } = await this.getManagedTeamOrThrow(userId);
    await this.getDriverUserOrThrow(driverId);

    const access = await this.prisma.teamDriverAccess.upsert({
      where: {
        teamId_driverId: {
          teamId: team.id,
          driverId,
        },
      },
      create: {
        teamId: team.id,
        driverId,
        status: TeamDriverAccessStatus.REJECTED,
        approvedById: user.id,
      },
      update: {
        status: TeamDriverAccessStatus.REJECTED,
        approvedById: user.id,
      },
    });

    return {
      message: 'El conductor fue rechazado para este equipo.',
      access,
    };
  }
}
