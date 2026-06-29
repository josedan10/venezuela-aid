import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/backend/prisma/prisma.module';
import { RedisModule } from '../src/backend/redis/redis.module';
import { ResourcesModule } from '../src/backend/resources/resources.module';
import { NeedsModule } from '../src/backend/needs/needs.module';
import { DispatchModule } from '../src/backend/dispatch/dispatch.module';
import { PrismaService } from '../src/backend/prisma/prisma.service';
import { RedisService } from '../src/backend/redis/redis.service';
import { io, Socket } from 'socket.io-client';
import { DispatchStatus, NeedStatus, Role, DriverStatus } from '@prisma/client';
import { DispatchService } from '../src/backend/dispatch/dispatch.service';
import { ResourcesService } from '../src/backend/resources/resources.service';

// Disable background intervals for testing to avoid open handles and crashes
DispatchService.prototype.onModuleInit = () => {};
ResourcesService.prototype.onModuleInit = () => {};

describe('E2E Simulation - Dispatch & Location Buffering', () => {
  let app: INestApplication;
  let port: number;
  let socket: Socket;

  const mockRedisClient = {
    smembers: jest.fn().mockResolvedValue([]),
    sadd: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    geoadd: jest.fn().mockResolvedValue(1),
    georadius: jest.fn().mockResolvedValue([]),
  };

  const mockRedisService = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    getClient: () => mockRedisClient,
    setDriverAvailability: jest.fn(),
    getDriverAvailability: jest.fn(),
    findNearbyDrivers: jest.fn(),
    updateDriverLocation: jest.fn(),
    removeDriverLocation: jest.fn(),
  };

  const mockPrismaService = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: jest.fn(async (cb) => cb(mockPrismaService)),
    $queryRaw: jest.fn(),
    need: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    dispatchTask: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    needItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    resource: {
      update: jest.fn(),
    },
    stockTransaction: {
      create: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        RedisModule,
        ResourcesModule,
        NeedsModule,
        DispatchModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const address = app.getHttpServer().address();
    port = typeof address === 'string' ? 5001 : address.port;
  });

  afterAll(async () => {
    if (socket) {
      socket.disconnect();
    }
    await app.close();
  });

  it('should simulate driver proposal, connection loss, location buffering, reconnection, and dispatch completion', async () => {
    const driverId = 'driver-e2e';
    const needId = 'need-e2e';
    const taskId = 'task-e2e';

    // 1. Mock driver online availability setup
    mockRedisService.setDriverAvailability.mockResolvedValue(undefined);

    // 2. Connect mock socket driver client
    socket = io(`http://localhost:${port}`, {
      query: { driverId },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      socket.once('connect', () => {
        resolve();
      });
    });

    expect(socket.connected).toBe(true);
    expect(mockRedisService.setDriverAvailability).toHaveBeenCalledWith(driverId, true);

    // 3. Setup mock behaviors for proposal dispatch
    const mockNeed = {
      id: needId,
      description: 'Medicamentos críticos para ambulatorio',
      status: NeedStatus.PENDING,
      latitude: 10.5,
      longitude: -66.9,
      items: [],
    };
    mockPrismaService.need.findUnique.mockResolvedValueOnce(mockNeed);
    mockRedisClient.smembers.mockResolvedValueOnce([]); // no attempts yet
    mockRedisService.findNearbyDrivers.mockResolvedValueOnce([driverId]);
    mockPrismaService.user.findUnique.mockResolvedValueOnce({
      id: driverId,
      role: Role.DRIVER,
      driverDetails: { status: DriverStatus.VERIFIED },
    });
    mockRedisService.getDriverAvailability.mockResolvedValueOnce('Disponible');

    const mockTask = {
      id: taskId,
      needId,
      driverId,
      status: DispatchStatus.PROPOSED,
      timeoutAt: new Date(Date.now() + 60000),
    };
    mockPrismaService.dispatchTask.create.mockResolvedValueOnce(mockTask);

    // 4. Capture proposal message on client side
    const proposalPromise = new Promise<any>((resolve) => {
      socket.once('dispatch_proposal', (data) => {
        resolve(data);
      });
    });

    // Send proposal request via REST API
    const proposeResponse = await fetch(`http://localhost:${port}/dispatch/propose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ needId }),
    });

    const proposeResult = await proposeResponse.json();
    expect(proposeResult.success).toBe(true);

    const proposalReceived = await proposalPromise;
    expect(proposalReceived.taskId).toBe(taskId);
    expect(proposalReceived.description).toBe(mockNeed.description);

    // 5. Simulate CONNECTION LOSS (disconnect socket)
    const disconnectPromise = new Promise<void>((resolve) => {
      socket.once('disconnect', () => resolve());
    });
    socket.disconnect();
    await disconnectPromise;
    // Wait for server-side disconnect handler to finish executing
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(socket.connected).toBe(false);
    expect(mockRedisService.setDriverAvailability).toHaveBeenCalledWith(driverId, false);
    expect(mockRedisService.removeDriverLocation).toHaveBeenCalledWith(driverId);

    // 6. Simulate IndexedDB offline buffering (local memory coordinates log)
    const bufferedCoords = [
      { latitude: 10.501, longitude: -66.901, timestamp: new Date().toISOString() },
      { latitude: 10.502, longitude: -66.902, timestamp: new Date().toISOString() },
    ];

    // 7. Simulate SOCKET RECONNECTION
    const reconnectPromise = new Promise<void>((resolve) => {
      socket.once('connect', () => resolve());
    });
    socket.connect();
    await reconnectPromise;
    // Wait for server-side connection handler to finish executing
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(socket.connected).toBe(true);

    // 8. Reconnection triggers uploading buffered coordinates (location_batch)
    const batchReceivedPromise = new Promise<any>((resolve) => {
      socket.once('batch_received', (data) => {
        resolve(data);
      });
    });

    socket.emit('location_batch', { coordinates: bufferedCoords });

    const batchAck = await batchReceivedPromise;
    expect(batchAck.status).toBe('ok');
    expect(batchAck.count).toBe(2);
    expect(mockRedisService.updateDriverLocation).toHaveBeenCalledTimes(2);

    // 9. Driver accepts the dispatch task
    mockPrismaService.$queryRaw.mockResolvedValueOnce([mockTask]);
    mockRedisClient.exists.mockResolvedValueOnce(1); // active proposal in Redis
    mockPrismaService.dispatchTask.update.mockResolvedValueOnce({
      ...mockTask,
      status: DispatchStatus.ACCEPTED,
      acceptedAt: new Date(),
    });
    mockPrismaService.need.update.mockResolvedValueOnce({
      id: needId,
      status: NeedStatus.ALLOCATED,
    });

    const acceptResponse = await fetch(`http://localhost:${port}/dispatch/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, taskId }),
    });

    const acceptResult = await acceptResponse.json();
    expect(acceptResponse.status).toBe(201);
    expect(acceptResult.message).toBe('Despacho aceptado con éxito y recursos reservados.');
    expect(acceptResult.task.status).toBe(DispatchStatus.ACCEPTED);

    // 10. Driver completes the delivery
    mockPrismaService.dispatchTask.findUnique.mockResolvedValueOnce({
      ...mockTask,
      status: DispatchStatus.ACCEPTED,
    });
    mockPrismaService.dispatchTask.update.mockResolvedValueOnce({
      ...mockTask,
      status: DispatchStatus.DELIVERED,
      signatureUrl: 'http://s3.local/sig.png',
      photoUrl: 'http://s3.local/photo.png',
    });
    mockPrismaService.need.update.mockResolvedValueOnce({
      id: needId,
      status: NeedStatus.FULFILLED,
    });

    const confirmResponse = await fetch(`http://localhost:${port}/dispatch/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId,
        taskId,
        signatureUrl: 'http://s3.local/sig.png',
        photoUrl: 'http://s3.local/photo.png',
      }),
    });

    const confirmResult = await confirmResponse.json();
    expect(confirmResponse.status).toBe(201);
    expect(confirmResult.message).toBe('Su entrega ha sido completada con éxito.');
    expect(confirmResult.task.status).toBe(DispatchStatus.DELIVERED);
  }, 15000);
});
