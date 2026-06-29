import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { DriverStatus } from '@prisma/client';
import { Role } from './role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    driverDetails: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRedis = {
    setDriverAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a user with roles', async () => {
      const dto: RegisterDto = {
        firebaseId: 'test-firebase-uid',
        email: 'driver@test.com',
        name: 'Juan Pérez',
        roles: 'DRIVER,DONOR',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'driver-id-123' });

      const result = await service.register(dto);

      expect(result.message).toBe('Registro completado exitosamente.');
      expect(result.userId).toBe('driver-id-123');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should successfully register an NGO and append RIF to name', async () => {
      const dto: RegisterDto = {
        firebaseId: 'ngo-firebase-uid',
        email: 'ngo@test.com',
        name: 'Cáritas Venezuela',
        roles: 'NGO',
        rif: 'J-123456789-0',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'ngo-id-123' });

      const result = await service.register(dto);

      expect(result.message).toBe('Registro completado exitosamente.');
      expect(result.userId).toBe('ngo-id-123');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          firebaseId: dto.firebaseId,
          email: dto.email,
          name: 'Cáritas Venezuela (J-123456789-0)',
          roles: 'NGO',
        },
      });
    });
  });

  describe('completeDriverProfile', () => {
    it('should successfully complete driver profile and set status to PENDING_APPROVAL', async () => {
      const mockUser = {
        id: 'driver-id-123',
        roles: 'DRIVER',
        driverDetails: null,
      };
      const details = {
        cedula: 'V-12345678',
        vehicleDetails: 'Toyota Hilux',
        licensePlate: 'ABC12D',
        licenseDocUrl: 'https://storage.local/license.pdf',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.driverDetails.findUnique.mockResolvedValue(null);
      mockPrisma.driverDetails.create.mockResolvedValue({});

      const result = await service.completeDriverProfile('driver-id-123', details);

      expect(result.message).toBe('Perfil de conductor actualizado y enviado para revisión del administrador.');
      expect(prisma.driverDetails.create).toHaveBeenCalled();
    });

    it('should successfully complete driver profile without a licenseDocUrl', async () => {
      const mockUser = {
        id: 'driver-id-123',
        roles: 'DRIVER',
        driverDetails: null,
      };
      const details = {
        cedula: 'V-87654321',
        vehicleDetails: 'Ford Fiesta',
        licensePlate: 'DEF34G',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.driverDetails.findUnique.mockResolvedValue(null);
      mockPrisma.driverDetails.create.mockResolvedValue({});

      const result = await service.completeDriverProfile('driver-id-123', details);

      expect(result.message).toBe('Perfil de conductor actualizado y enviado para revisión del administrador.');
      expect(prisma.driverDetails.create).toHaveBeenCalledWith({
        data: {
          userId: 'driver-id-123',
          cedula: 'V-87654321',
          vehicleDetails: 'Ford Fiesta',
          licensePlate: 'DEF34G',
          licenseDocUrl: null,
          status: DriverStatus.PENDING_APPROVAL,
        },
      });
    });
  });

  describe('approveDriver', () => {
    it('should successfully approve a driver registration', async () => {
      const driverId = 'driver-id-123';
      const mockDriver = {
        id: driverId,
        roles: 'DRIVER',
        driverDetails: { status: DriverStatus.PENDING_APPROVAL },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.driverDetails.update.mockResolvedValue({});

      const result = await service.approveDriver(driverId);

      expect(result.message).toBe('Su cuenta ha sido verificada. Ya puede iniciar sesión y realizar servicios.');
      expect(prisma.driverDetails.update).toHaveBeenCalledWith({
        where: { userId: driverId },
        data: {
          status: DriverStatus.VERIFIED,
          verifiedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if user is not found or is not a driver', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.approveDriver('invalid-id')).rejects.toThrow(
        new NotFoundException('Conductor no encontrado.'),
      );
    });
  });

  describe('toggleAvailability', () => {
    it('should set availability status in Redis for verified driver', async () => {
      const driverId = 'driver-id-123';
      const mockDriver = {
        id: driverId,
        roles: 'DRIVER',
        driverDetails: { status: DriverStatus.VERIFIED },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockDriver);
      mockRedis.setDriverAvailability.mockResolvedValue(true);

      const result = await service.toggleAvailability(driverId, true);

      expect(result.available).toBe(true);
      expect(result.message).toBe('Estado: Disponible para despachos');
      expect(redis.setDriverAvailability).toHaveBeenCalledWith(driverId, true);
    });

    it('should throw BadRequestException if driver is not verified', async () => {
      const driverId = 'driver-id-123';
      const mockDriver = {
        id: driverId,
        roles: 'DRIVER',
        driverDetails: { status: DriverStatus.PENDING_APPROVAL },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockDriver);

      await expect(service.toggleAvailability(driverId, true)).rejects.toThrow(
        new BadRequestException('La cuenta de conductor no está verificada.'),
      );
    });
  });
});
