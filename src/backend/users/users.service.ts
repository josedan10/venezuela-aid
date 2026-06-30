import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
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

  async completeDriverProfile(userId: string, details: { cedula: string; vehicleDetails: string; licensePlate: string; licenseDocUrl?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverDetails: true },
    });

    if (!user || !user.roles.split(',').includes('DRIVER')) {
      throw new BadRequestException('El usuario no está registrado con el rol de Conductor.');
    }

    if (!details.cedula || !details.vehicleDetails || !details.licensePlate) {
      throw new BadRequestException('La cédula, los detalles del vehículo y la placa son obligatorios.');
    }

    // Check if cedula is already registered to someone else
    const existingDriver = await this.prisma.driverDetails.findUnique({
      where: { cedula: details.cedula },
    });
    if (existingDriver && existingDriver.userId !== userId) {
      throw new BadRequestException('La cédula ya está registrada para otro conductor.');
    }

    if (user.driverDetails) {
      await this.prisma.driverDetails.update({
        where: { userId },
        data: {
          cedula: details.cedula,
          vehicleDetails: details.vehicleDetails,
          licensePlate: details.licensePlate,
          licenseDocUrl: details.licenseDocUrl || null,
          status: DriverStatus.PENDING_APPROVAL,
        },
      });
    } else {
      await this.prisma.driverDetails.create({
        data: {
          userId,
          cedula: details.cedula,
          vehicleDetails: details.vehicleDetails,
          licensePlate: details.licensePlate,
          licenseDocUrl: details.licenseDocUrl || null,
          status: DriverStatus.PENDING_APPROVAL,
        },
      });
    }

    return {
      message: 'Perfil de conductor actualizado y enviado para revisión del administrador.',
    };
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

  async toggleAvailability(driverId: string, available: boolean) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverDetails: true },
    });

    if (!driver || !driver.roles.split(',').includes('DRIVER') || !driver.driverDetails) {
      throw new NotFoundException('Conductor no encontrado o sin perfil registrado.');
    }

    if (driver.driverDetails.status !== DriverStatus.VERIFIED) {
      throw new BadRequestException('La cuenta de conductor no está verificada.');
    }

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
