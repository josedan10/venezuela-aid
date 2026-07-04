import { Test, TestingModule } from '@nestjs/testing';
import { NeedsService } from './needs.service';
import { PrismaService } from '../prisma/prisma.service';
import { NeedStatus } from '@prisma/client';
import { MatchingService } from '../matching/matching.service';
import { DispatchService } from '../dispatch/dispatch.service';

describe('NeedsService', () => {
  let service: NeedsService;
  let prisma: PrismaService;
  let matchingService: MatchingService;
  let dispatchService: DispatchService;

  const mockPrisma = {
    need: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    dispatchTask: {
      findFirst: jest.fn(),
    },
  };

  const mockMatchingService = {
    matchResourcesForNeed: jest.fn(),
  };

  const mockDispatchService = {
    createDispatchTask: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedsService,
        { provide: MatchingService, useValue: mockMatchingService },
        { provide: DispatchService, useValue: mockDispatchService },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<NeedsService>(NeedsService);
    prisma = module.get<PrismaService>(PrismaService);
    matchingService = module.get<MatchingService>(MatchingService);
    dispatchService = module.get<DispatchService>(DispatchService);
    jest.clearAllMocks();
  });

  describe('createNeed priority scoring math', () => {
    it.each([
      { urgencyRating: 1, expectedScore: 18, expectedImmediate: false },
      { urgencyRating: 2, expectedScore: 36, expectedImmediate: false },
      { urgencyRating: 3, expectedScore: 54, expectedImmediate: false },
      { urgencyRating: 4, expectedScore: 72, expectedImmediate: false },
      { urgencyRating: 5, expectedScore: 95, expectedImmediate: true },
    ])(
      'should compute score $expectedScore and isImmediate $expectedImmediate for rating $urgencyRating',
      async ({ urgencyRating, expectedScore, expectedImmediate }) => {
        const dto = {
          description: 'Comida para refugio',
          urgencyRating,
          state: 'Miranda',
          sector: 'Chacao',
          latitude: 10.49,
          longitude: -66.85,
          items: [
            { itemId: 'item-1', quantity: 10 },
          ],
        };

        const mockCreatedNeed = {
          id: 'need-123',
          ngoId: 'ngo-456',
          description: dto.description,
          urgencyScore: expectedScore,
          isImmediate: expectedImmediate,
          state: dto.state,
          sector: dto.sector,
          latitude: dto.latitude,
          longitude: dto.longitude,
          status: NeedStatus.PENDING,
          items: [
            { id: 'item-1', needId: 'need-123', itemId: 'item-1', quantity: 10 },
          ],
        };

        mockPrisma.need.create.mockResolvedValue(mockCreatedNeed);
        mockPrisma.need.findUnique.mockResolvedValue({
          ...mockCreatedNeed,
          items: [],
          ngo: {},
          collectionCenter: null,
        });
        mockMatchingService.matchResourcesForNeed.mockResolvedValue({
          needId: 'need-123',
          matched: 0,
          total: 1,
          origin: null,
        });
        mockDispatchService.createDispatchTask.mockResolvedValue({
          success: true,
          message: 'ok',
        });

        const result = await service.createNeed('ngo-456', dto);

        expect(mockPrisma.need.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              ngoId: 'ngo-456',
              description: dto.description,
              urgencyScore: expectedScore,
              isImmediate: expectedImmediate,
              state: dto.state,
              sector: dto.sector,
              latitude: dto.latitude,
              longitude: dto.longitude,
              originLatitude: dto.latitude,
              originLongitude: dto.longitude,
              originLabel: `${dto.state} - ${dto.sector}`,
              collectionCenterId: null,
              status: NeedStatus.PENDING,
              items: {
                create: [
                  { itemId: 'item-1', quantity: 10 },
                ],
              },
            }),
            include: {
              items: {
                include: { item: true, matchedResource: { include: { item: true } } },
              },
              ngo: true,
              collectionCenter: true,
            },
          }),
        );

        expect(mockMatchingService.matchResourcesForNeed).toHaveBeenCalledWith('need-123');
        expect(mockDispatchService.createDispatchTask).not.toHaveBeenCalled();

        expect(result.need.urgencyScore).toBe(expectedScore);
        expect(result.need.isImmediate).toBe(expectedImmediate);
        if (expectedImmediate) {
          expect(result.message).toBe('Solicitud registrada con prioridad crítica.');
        } else {
          expect(result.message).toBe('Solicitud registrada exitosamente.');
        }
      },
    );

    it('should trigger a dispatch proposal when matching finds resources', async () => {
      const dto = {
        description: 'Comida para refugio',
        urgencyRating: 5,
        state: 'Miranda',
        sector: 'Chacao',
        latitude: 10.49,
        longitude: -66.85,
        items: [
          { itemId: 'item-1', quantity: 10 },
        ],
      };

      const mockCreatedNeed = {
        id: 'need-999',
        ngoId: 'ngo-456',
        description: dto.description,
        urgencyScore: 95,
        isImmediate: true,
        state: dto.state,
        sector: dto.sector,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: NeedStatus.PENDING,
        items: [
          { id: 'need-item-1', needId: 'need-999', itemId: 'item-1', quantity: 10 },
        ],
      };

      mockPrisma.need.create.mockResolvedValue(mockCreatedNeed);
      mockPrisma.need.findUnique.mockResolvedValue({
        ...mockCreatedNeed,
        items: [
          { id: 'need-item-1', needId: 'need-999', itemId: 'item-1', quantity: 10 },
        ],
        ngo: {},
        collectionCenter: null,
      });
      mockMatchingService.matchResourcesForNeed.mockResolvedValue({
        needId: 'need-999',
        matched: 1,
        total: 1,
        origin: { latitude: dto.latitude, longitude: dto.longitude, label: 'Miranda - Chacao' },
      });
      mockDispatchService.createDispatchTask.mockResolvedValue({
        success: true,
        message: 'Propuesta de despacho enviada al conductor más cercano al punto de origen.',
        task: { id: 'dispatch-1', status: 'PROPOSED' },
        created: true,
      });

      const result = await service.createNeed('ngo-456', dto);

      expect(mockMatchingService.matchResourcesForNeed).toHaveBeenCalledWith('need-999');
      expect(mockDispatchService.createDispatchTask).toHaveBeenCalledWith('need-999');
      expect(result.dispatch).toEqual({
        success: true,
        message: 'Propuesta de despacho enviada al conductor más cercano al punto de origen.',
        task: { id: 'dispatch-1', status: 'PROPOSED' },
        created: true,
      });
    });
  });
});
