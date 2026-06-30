import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { CompleteDriverProfileDto } from './dto/complete-driver-profile.dto';
import { DriverStatus } from '@prisma/client';
import { Role } from './role.enum';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async findByFirebaseId(firebaseId: string) {
    return this.prisma.user.findUnique({
      where: { firebaseId },
      include: { driverDetails: true },
    });
  }

  async register(dto: RegisterDto) {
    // 1. Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException('El correo electrónico ya está registrado.');
    }

    // Check if firebaseId already exists
    const existingFirebaseUser = await this.prisma.user.findUnique({
      where: { firebaseId: dto.firebaseId },
    });
    if (existingFirebaseUser) {
      throw new BadRequestException('El usuario de Firebase ya está registrado.');
    }

    // Create User with basic info (No restrictions, can add RIF or vehicle details later)
    let formattedName = dto.name;
    if (dto.rif && (dto.roles.includes('NGO') || dto.roles.includes('DONOR'))) {
      formattedName = `${dto.name} (${dto.rif})`;
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firebaseId: dto.firebaseId,
        name: formattedName,
        roles: dto.roles,
      },
    });

    return {
      message: 'Registro completado exitosamente.',
      userId: user.id,
      user,
    };
  }

  async completeDriverProfile(userId: string, details: CompleteDriverProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverDetails: true },
    });

    if (!user || !user.roles.split(',').includes('DRIVER')) {
      throw new BadRequestException('El usuario no está registrado con el rol de Conductor.');
    }

    if (
      !details.cedula ||
      !details.vehicleCategory ||
      !details.seatCount ||
      !details.vehicleDetails ||
      !details.licensePlate
    ) {
      throw new BadRequestException(
        'La cédula, categoría del vehículo, asientos, detalles y la placa son obligatorios.',
      );
    }

    if (details.seatCount < 1 || details.seatCount > 60) {
      throw new BadRequestException('El número de asientos debe estar entre 1 y 60.');
    }

    // Check if cedula is already registered to someone else
    const existingDriver = await this.prisma.driverDetails.findUnique({
      where: { cedula: details.cedula },
    });
    if (existingDriver && existingDriver.userId !== userId) {
      throw new BadRequestException('La cédula ya está registrada para otro conductor.');
    }

    if (user.driverDetails?.status === DriverStatus.REJECTED) {
      throw new BadRequestException('Su cuenta de conductor fue rechazada y no puede actualizar el perfil.');
    }

    const isUpdate = Boolean(user.driverDetails);
    const status = isUpdate ? user.driverDetails!.status : DriverStatus.VERIFIED;
    const verifiedAt = isUpdate ? user.driverDetails!.verifiedAt : new Date();

    const driverData = {
      cedula: details.cedula,
      vehicleCategory: details.vehicleCategory,
      seatCount: details.seatCount,
      vehicleDetails: details.vehicleDetails,
      licensePlate: details.licensePlate,
      licenseDocUrl: details.licenseDocUrl || null,
      status,
      verifiedAt,
    };

    if (user.driverDetails) {
      await this.prisma.driverDetails.update({
        where: { userId },
        data: driverData,
      });
    } else {
      await this.prisma.driverDetails.create({
        data: {
          userId,
          ...driverData,
        },
      });
    }

    return {
      message: 'Perfil de conductor guardado. Ya puede conectarse y recibir asignaciones.',
    };
  }

  async listPendingDrivers() {
    return this.prisma.user.findMany({
      where: {
        roles: { contains: 'DRIVER' },
        driverDetails: { status: DriverStatus.PENDING_APPROVAL },
      },
      include: { driverDetails: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listFleet() {
    const drivers = await this.prisma.user.findMany({
      where: {
        roles: { contains: 'DRIVER' },
        driverDetails: {
          status: { in: [DriverStatus.VERIFIED, DriverStatus.PENDING_APPROVAL] },
        },
      },
      include: { driverDetails: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      drivers.map(async (driver) => {
        const availability = await this.redisService.getDriverAvailability(driver.id);
        return {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          available: availability === 'Disponible',
          driverDetails: driver.driverDetails,
        };
      }),
    );
  }

  async approveDriver(driverId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverDetails: true },
    });

    if (!driver || !driver.roles.split(',').includes('DRIVER') || !driver.driverDetails) {
      throw new NotFoundException('Conductor no encontrado.');
    }

    await this.prisma.driverDetails.update({
      where: { userId: driverId },
      data: {
        status: DriverStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    return {
      message: 'Su cuenta ha sido verificada. Ya puede iniciar sesión y realizar servicios.',
    };
  }

  private async ensureDriverOperational(driverId: string, status: DriverStatus) {
    if (status === DriverStatus.REJECTED) {
      throw new BadRequestException('La cuenta de conductor fue rechazada.');
    }
    if (status === DriverStatus.PENDING_APPROVAL) {
      await this.prisma.driverDetails.update({
        where: { userId: driverId },
        data: {
          status: DriverStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });
    }
  }

  async toggleAvailability(driverId: string, available: boolean) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverDetails: true },
    });

    if (!driver || !driver.roles.split(',').includes('DRIVER') || !driver.driverDetails) {
      throw new NotFoundException('Conductor no encontrado o sin perfil registrado.');
    }

    await this.ensureDriverOperational(driverId, driver.driverDetails.status);

    await this.redisService.setDriverAvailability(driverId, available);

    const statusMsg = available ? 'Disponible para despachos' : 'No disponible para despachos';
    return {
      message: `Estado: ${statusMsg}`,
      available,
    };
  }

  async saveSelfie(userId: string, selfieUrl: string) {
    if (!selfieUrl) {
      throw new BadRequestException('La selfie es obligatoria.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { selfieUrl },
    });
    return {
      message: 'Selfie guardada exitosamente.',
      user,
    };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('El nombre no puede estar vacío.');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: data.name.trim() },
    });
    return { message: 'Perfil actualizado correctamente.', user };
  }

  async updateAlertRadius(userId: string, alertRadiusKm: number) {
    if (typeof alertRadiusKm !== 'number' || !Number.isFinite(alertRadiusKm)) {
      throw new BadRequestException('El radio de alerta debe ser un número válido.');
    }
    if (alertRadiusKm < 1 || alertRadiusKm > 100) {
      throw new BadRequestException('El radio de alerta debe estar entre 1 y 100 km.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { alertRadiusKm },
      include: { driverDetails: true },
    });

    return {
      message: 'Radio de alerta actualizado.',
      alertRadiusKm: user.alertRadiusKm,
      user,
    };
  }
}
