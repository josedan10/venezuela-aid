import { Test, TestingModule } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ResourcesService } from '../resources/resources.service';
import { DispatchGateway } from './dispatch.gateway';
import { DispatchStatus, NeedStatus, DriverStatus, DispatchTask } from '@prisma/client';
import { Role } from '../users/role.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DispatchService', () => {
  let service: DispatchService;
  let prisma: PrismaService;
  let redisService: RedisService;
  let dispatchGateway: DispatchGateway;

  const mockRedisClient = {
    smembers: jest.fn(),
    sadd: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    geopos: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    setDriverAvailability: jest.fn(),
    getDriverAvailability: jest.fn(),
    findNearbyDrivers: jest.fn(),
    updateDriverLocation: jest.fn(),
    removeDriverLocation: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn(),
    dispatchTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    need: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    teamDriverAccess: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    needItem: {
      findMany: jest.fn(),
    },
    resource: {
      update: jest.fn(),
    },
    stockTransaction: {
      create: jest.fn(),
    },
  };

  const mockResourcesService = {
    adjustStock: jest.fn(),
  };

  const mockDispatchGateway = {
    sendProposalToDriver: jest.fn(),
    notifyOperatorsConnectionLost: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma));
    mockRedisService.getClient.mockImplementation(() => mockRedisClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: ResourcesService, useValue: mockResourcesService },
        { provide: DispatchGateway, useValue: mockDispatchGateway },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
    prisma = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    dispatchGateway = module.get<DispatchGateway>(DispatchGateway);

    jest.clearAllMocks();
  });

  describe('concurrency control', () => {
    it('should successfully let the first driver accept, and reject the second driver trying to accept concurrently', async () => {
      const taskId = 'task-1';
      const driverId1 = 'driver-1';
      const driverId2 = 'driver-2';
      const needId = 'need-1';

      const taskProposed = {
        id: taskId,
        needId,
        driverId: driverId1,
        status: DispatchStatus.PROPOSED,
        timeoutAt: new Date(Date.now() + 60000),
      };

      // Mock first call (Driver 1 accepts successfully)
      // $queryRaw returns taskProposed
      mockPrisma.$queryRaw.mockResolvedValueOnce([taskProposed]);
      mockRedisClient.exists.mockResolvedValueOnce(1); // Redis proposal key exists
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.update.mockResolvedValueOnce({
        ...taskProposed,
        status: DispatchStatus.ACCEPTED,
      });
      mockPrisma.needItem.findMany.mockResolvedValueOnce([
        { resourceId: 'res-1', quantity: 2 },
      ]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'res-1', name: 'Agua', stockQuantity: 10 },
      ]);

      const result1 = await service.acceptDispatchTask(driverId1, taskId);
      expect(result1.task.status).toBe(DispatchStatus.ACCEPTED);
      expect(mockPrisma.dispatchTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: taskId },
          data: expect.objectContaining({ status: DispatchStatus.ACCEPTED }),
        }),
      );

      // Mock second call (Driver 2 tries to accept same task)
      const taskAlreadyAccepted = {
        id: taskId,
        needId,
        driverId: driverId1,
        status: DispatchStatus.ACCEPTED,
        timeoutAt: new Date(Date.now() + 60000),
      };

      // If Driver 2 tries to accept it:
      mockPrisma.$queryRaw.mockResolvedValueOnce([taskAlreadyAccepted]);
      await expect(
        service.acceptDispatchTask(driverId2, taskId),
      ).rejects.toThrow('Este despacho no fue propuesto a usted.');

      // If Driver 1 tries to accept it again:
      mockPrisma.$queryRaw.mockResolvedValueOnce([taskAlreadyAccepted]);
      await expect(
        service.acceptDispatchTask(driverId1, taskId),
      ).rejects.toThrow('Este despacho ya ha sido asignado a otro conductor.');
    });

    it('should rollback transaction if stock is insufficient when accepting task', async () => {
      const taskId = 'task-1';
      const driverId = 'driver-1';
      const needId = 'need-1';

      const taskProposed = {
        id: taskId,
        needId,
        driverId: driverId,
        status: DispatchStatus.PROPOSED,
        timeoutAt: new Date(Date.now() + 60000),
      };

      mockPrisma.$queryRaw.mockResolvedValueOnce([taskProposed]);
      mockRedisClient.exists.mockResolvedValueOnce(1); // Redis proposal key exists
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.needItem.findMany.mockResolvedValueOnce([
        { resourceId: 'res-1', quantity: 20 },
      ]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { id: 'res-1', name: 'Agua', stockQuantity: 5 }, // 5 < 20
      ]);

      await expect(
        service.acceptDispatchTask(driverId, taskId),
      ).rejects.toThrow('Stock insuficiente para el recurso: Agua.');
    });
  });

  describe('Redis proposal timeouts', () => {
    it('should fail to accept task if Redis proposal key has expired (concurrency/timeout simulation)', async () => {
      const taskId = 'task-1';
      const driverId = 'driver-1';
      const needId = 'need-1';

      const taskProposed = {
        id: taskId,
        needId,
        driverId: driverId,
        status: DispatchStatus.PROPOSED,
        timeoutAt: new Date(Date.now() + 60000),
      };

      mockPrisma.$queryRaw.mockResolvedValueOnce([taskProposed]);
      mockRedisClient.exists.mockResolvedValueOnce(0); // 0 = Redis key does not exist (timeout)
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.update.mockResolvedValueOnce({
        ...taskProposed,
        status: DispatchStatus.TIMED_OUT,
      });

      await expect(
        service.acceptDispatchTask(driverId, taskId),
      ).rejects.toThrow('El tiempo para aceptar este despacho ha expirado.');

      expect(mockPrisma.dispatchTask.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: { status: DispatchStatus.TIMED_OUT },
      });
    });

    it('checkProposalTimeouts should find expired tasks in DB, mark them TIMED_OUT, free driver, and propose to next driver', async () => {
      const expiredTask = {
        id: 'task-expired',
        needId: 'need-1',
        driverId: 'driver-expired',
        status: DispatchStatus.PROPOSED,
        timeoutAt: new Date(Date.now() - 10000), // 10s in the past
      };

      mockPrisma.dispatchTask.findMany.mockResolvedValueOnce([expiredTask]);
      mockPrisma.dispatchTask.update.mockResolvedValueOnce({
        ...expiredTask,
        status: DispatchStatus.TIMED_OUT,
      });

      // For createDispatchTask inside proposal timeout handler:
      const need = {
        id: 'need-1',
        description: 'Need description',
        status: NeedStatus.PENDING,
        latitude: 10.5,
        longitude: -66.9,
        items: [],
      };
      mockPrisma.need.findUnique.mockResolvedValueOnce(need);
      mockPrisma.need.findUnique.mockResolvedValueOnce({
        status: NeedStatus.PENDING,
      });
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockRedisClient.smembers.mockResolvedValueOnce(['driver-expired']);
      mockRedisService.findNearbyDrivers.mockResolvedValueOnce(['driver-2']);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'driver-2',
        roles: 'DRIVER',
        driverDetails: { status: DriverStatus.VERIFIED },
      });
      mockRedisService.getDriverAvailability.mockResolvedValueOnce('Disponible');
      mockRedisClient.geopos.mockResolvedValueOnce([[ -66.9, 10.5 ]]);
      mockPrisma.dispatchTask.create.mockResolvedValueOnce({ id: 'task-new' });

      await service.checkProposalTimeouts();

      expect(mockPrisma.dispatchTask.update).toHaveBeenCalledWith({
        where: { id: 'task-expired' },
        data: { status: DispatchStatus.TIMED_OUT },
      });
      expect(mockRedisService.setDriverAvailability).toHaveBeenCalledWith('driver-expired', true);
      // Verify that it attempts to schedule next driver
      expect(mockPrisma.need.findUnique).toHaveBeenCalledWith({
        where: { id: 'need-1' },
        include: {
          items: { include: { item: true, matchedResource: { include: { item: true } } } },
          collectionCenter: true,
          ngo: { select: { id: true, teamId: true } },
        },
      });
    });
  });

  describe('team-aware dispatch selection', () => {
    it('should prefer a team member over an external driver in TEAM_ONLY mode and skip external drivers', async () => {
      const needId = 'need-team-only';
      const teamId = 'team-1';
      const taskId = 'task-team-only';

      mockPrisma.need.findUnique.mockResolvedValueOnce({
        id: needId,
        status: NeedStatus.PENDING,
        state: 'Miranda',
        sector: 'Chacao',
        latitude: 10.5,
        longitude: -66.8,
        originLatitude: 10.5,
        originLongitude: -66.8,
        originLabel: 'Miranda - Chacao',
        items: [],
        collectionCenter: null,
        ngo: { id: 'ngo-1', teamId },
      });
      mockPrisma.need.findUnique.mockResolvedValueOnce({
        status: NeedStatus.PENDING,
      });
      mockPrisma.team.findUnique.mockResolvedValueOnce({
        id: teamId,
        deliveryPolicy: 'TEAM_ONLY',
      });
      mockPrisma.teamDriverAccess.findMany.mockResolvedValueOnce([
        { driverId: 'driver-external' },
      ]);
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      mockRedisService.findNearbyDrivers.mockResolvedValueOnce(['driver-external', 'driver-team']);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'driver-external',
          roles: 'DRIVER',
          teamId: null,
          driverDetails: { status: DriverStatus.VERIFIED },
          alertRadiusKm: 15,
        })
        .mockResolvedValueOnce({
          id: 'driver-team',
          roles: 'DRIVER',
          teamId,
          driverDetails: { status: DriverStatus.VERIFIED },
          alertRadiusKm: 15,
        });
      mockRedisService.getDriverAvailability.mockResolvedValue('Disponible');
      mockRedisClient.geopos
        .mockResolvedValueOnce([[ -66.79, 10.51 ]])
        .mockResolvedValueOnce([[ -66.8, 10.5 ]]);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.create.mockResolvedValueOnce({
        id: taskId,
        needId,
        driverId: 'driver-team',
        status: DispatchStatus.PROPOSED,
      });

      const result = await service.createDispatchTask(needId);

      expect(result.success).toBe(true);
      expect(mockDispatchGateway.sendProposalToDriver).toHaveBeenCalledWith(
        'driver-team',
        expect.objectContaining({ taskId }),
      );
      expect(mockDispatchGateway.sendProposalToDriver).not.toHaveBeenCalledWith(
        'driver-external',
        expect.anything(),
      );
    });

    it('should prefer the team member over a closer approved external driver in TEAM_AND_APPROVED_EXTERNAL mode', async () => {
      const needId = 'need-team-and-external';
      const teamId = 'team-1';
      const taskId = 'task-team-and-external';

      mockPrisma.need.findUnique.mockResolvedValueOnce({
        id: needId,
        status: NeedStatus.PENDING,
        state: 'Miranda',
        sector: 'Chacao',
        latitude: 10.5,
        longitude: -66.8,
        originLatitude: 10.5,
        originLongitude: -66.8,
        originLabel: 'Miranda - Chacao',
        items: [],
        collectionCenter: null,
        ngo: { id: 'ngo-1', teamId },
      });
      mockPrisma.need.findUnique.mockResolvedValueOnce({
        status: NeedStatus.PENDING,
      });
      mockPrisma.team.findUnique.mockResolvedValueOnce({
        id: teamId,
        deliveryPolicy: 'TEAM_AND_APPROVED_EXTERNAL',
      });
      mockPrisma.teamDriverAccess.findMany.mockResolvedValueOnce([
        { driverId: 'driver-external' },
      ]);
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      mockRedisService.findNearbyDrivers.mockResolvedValueOnce(['driver-external', 'driver-team']);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'driver-external',
          roles: 'DRIVER',
          teamId: null,
          driverDetails: { status: DriverStatus.VERIFIED },
          alertRadiusKm: 15,
        })
        .mockResolvedValueOnce({
          id: 'driver-team',
          roles: 'DRIVER',
          teamId,
          driverDetails: { status: DriverStatus.VERIFIED },
          alertRadiusKm: 15,
        });
      mockRedisService.getDriverAvailability.mockResolvedValue('Disponible');
      mockRedisClient.geopos
        .mockResolvedValueOnce([[ -66.799, 10.500 ]])
        .mockResolvedValueOnce([[ -66.8, 10.6 ]]);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.findFirst.mockResolvedValueOnce(null);
      mockPrisma.dispatchTask.create.mockResolvedValueOnce({
        id: taskId,
        needId,
        driverId: 'driver-team',
        status: DispatchStatus.PROPOSED,
      });

      const result = await service.createDispatchTask(needId);

      expect(result.success).toBe(true);
      expect(mockDispatchGateway.sendProposalToDriver).toHaveBeenCalledWith(
        'driver-team',
        expect.objectContaining({ taskId }),
      );
    });

    it('should return an existing active task without creating a duplicate proposal', async () => {
      const needId = 'need-active';
      const activeTask = {
        id: 'dispatch-active',
        needId,
        driverId: 'driver-active',
        status: DispatchStatus.PROPOSED,
      };

      mockPrisma.need.findUnique.mockResolvedValueOnce({
        id: needId,
        status: NeedStatus.PENDING,
        state: 'Miranda',
        sector: 'Chacao',
        latitude: 10.5,
        longitude: -66.8,
        originLatitude: 10.5,
        originLongitude: -66.8,
        originLabel: 'Miranda - Chacao',
        items: [],
        collectionCenter: null,
        ngo: { id: 'ngo-1', teamId: null },
      });
      mockPrisma.need.findUnique.mockResolvedValueOnce({
        status: NeedStatus.PENDING,
      });
      mockRedisClient.smembers.mockResolvedValueOnce([]);
      mockRedisService.findNearbyDrivers.mockResolvedValueOnce(['driver-1']);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'driver-1',
        roles: 'DRIVER',
        teamId: null,
        driverDetails: { status: DriverStatus.VERIFIED },
        alertRadiusKm: 15,
      });
      mockRedisService.getDriverAvailability.mockResolvedValueOnce('Disponible');
      mockRedisClient.geopos.mockResolvedValueOnce([[ -66.8, 10.5 ]]);
      mockPrisma.dispatchTask.findFirst.mockImplementation(async () => activeTask);
      mockPrisma.dispatchTask.create.mockResolvedValueOnce({
        id: 'dispatch-generated',
        needId,
        driverId: 'driver-1',
        status: DispatchStatus.PROPOSED,
      });

      const result = await service.createDispatchTask(needId);

      expect(result).toEqual({
        success: true,
        message: 'Ya existe un despacho activo para esta necesidad.',
        task: activeTask,
        created: false,
      });
      expect(mockPrisma.dispatchTask.create).not.toHaveBeenCalled();
      expect(mockDispatchGateway.sendProposalToDriver).not.toHaveBeenCalled();
    });
  });
});
