import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { Role, DriverStatus } from '@prisma/client';

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

    // 2. Validate role-specific requirements
    if (dto.role === Role.DRIVER) {
      if (!dto.driverDetails || !dto.driverDetails.licenseDocUrl) {
        throw new BadRequestException('La licencia de conducir es obligatoria para registrarse como conductor.');
      }

      // Check if driver cedula is already registered
      const existingDriver = await this.prisma.driverDetails.findUnique({
        where: { cedula: dto.driverDetails.cedula },
      });
      if (existingDriver) {
        throw new BadRequestException('La cédula ya está registrada para otro conductor.');
      }

      // Create Driver with status PENDING_APPROVAL
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firebaseId: dto.firebaseId,
          name: dto.name,
          role: Role.DRIVER,
          driverDetails: {
            create: {
              cedula: dto.driverDetails.cedula,
              vehicleDetails: dto.driverDetails.vehicleDetails,
              licensePlate: dto.driverDetails.licensePlate,
              licenseDocUrl: dto.driverDetails.licenseDocUrl,
              status: DriverStatus.PENDING_APPROVAL,
            },
          },
        },
        include: { driverDetails: true },
      });

      return {
        message: 'Registro completado. Su cuenta está en revisión.',
        userId: user.id,
        user,
      };
    } else if (dto.role === Role.NGO || dto.role === Role.DONOR) {
      if (!dto.rif) {
        throw new BadRequestException('El RIF es obligatorio para registrarse como ONG o Donante.');
      }

      // Save RIF in the user's record: append it to the name in the database, e.g. "Name (RIF)"
      const formattedName = `${dto.name} (${dto.rif})`;
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firebaseId: dto.firebaseId,
          name: formattedName,
          role: dto.role,
        },
      });

      return {
        message: 'Registro completado exitosamente.',
        userId: user.id,
        user,
      };
    } else {
      // ADMIN or other role
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firebaseId: dto.firebaseId,
          name: dto.name,
          role: dto.role,
        },
      });

      return {
        message: 'Registro completado exitosamente.',
        userId: user.id,
        user,
      };
    }
  }

  async approveDriver(driverId: string) {
    const driver = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { driverDetails: true },
    });

    if (!driver || driver.role !== Role.DRIVER || !driver.driverDetails) {
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

    if (!driver || driver.role !== Role.DRIVER || !driver.driverDetails) {
      throw new NotFoundException('Conductor no encontrado.');
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
}
