import { Test, TestingModule } from '@nestjs/testing';
import { NeedsService } from './needs.service';
import { PrismaService } from '../prisma/prisma.service';
import { NeedStatus } from '@prisma/client';

describe('NeedsService', () => {
  let service: NeedsService;
  let prisma: PrismaService;

  const mockPrisma = {
    need: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NeedsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<NeedsService>(NeedsService);
    prisma = module.get<PrismaService>(PrismaService);
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
            { resourceId: 'res-1', quantity: 10 },
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
            { id: 'item-1', needId: 'need-123', resourceId: 'res-1', quantity: 10 },
          ],
        };

        mockPrisma.need.create.mockResolvedValue(mockCreatedNeed);

        const result = await service.createNeed('ngo-456', dto);

        expect(mockPrisma.need.create).toHaveBeenCalledWith({
          data: {
            ngoId: 'ngo-456',
            description: dto.description,
            urgencyScore: expectedScore,
            isImmediate: expectedImmediate,
            state: dto.state,
            sector: dto.sector,
            latitude: dto.latitude,
            longitude: dto.longitude,
            status: NeedStatus.PENDING,
            items: {
              create: [
                { resourceId: 'res-1', quantity: 10 },
              ],
            },
          },
          include: {
            items: {
              include: { resource: true },
            },
            ngo: true,
          },
        });

        expect(result.need.urgencyScore).toBe(expectedScore);
        expect(result.need.isImmediate).toBe(expectedImmediate);
        if (expectedImmediate) {
          expect(result.message).toBe('Solicitud registrada con prioridad crítica.');
        } else {
          expect(result.message).toBe('Solicitud registrada exitosamente.');
        }
      },
    );
  });
});
