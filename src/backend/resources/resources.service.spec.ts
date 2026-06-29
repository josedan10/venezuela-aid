import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResourceCategory } from '@prisma/client';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn(),
    resource: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockTransaction: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createResource', () => {
    it('should throw BadRequestException if FOOD category lacks expirationDate', async () => {
      await expect(
        service.createResource({
          name: 'Arroz',
          category: ResourceCategory.FOOD,
          stockQuantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if MEDICINES category has past expirationDate', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        service.createResource({
          name: 'Paracetamol',
          category: ResourceCategory.MEDICINES,
          stockQuantity: 5,
          expirationDate: pastDate.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create resource with valid future expirationDate', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const mockResource = {
        id: 'resource-123',
        name: 'Paracetamol',
        category: ResourceCategory.MEDICINES,
        stockQuantity: 5,
        expirationDate: futureDate,
      };

      mockPrisma.resource.create.mockResolvedValue(mockResource);
      mockPrisma.stockTransaction.create.mockResolvedValue({});

      const result = await service.createResource({
        name: 'Paracetamol',
        category: ResourceCategory.MEDICINES,
        stockQuantity: 5,
        expirationDate: futureDate.toISOString(),
      });

      expect(result).toEqual(mockResource);
      expect(mockPrisma.resource.create).toHaveBeenCalled();
    });

    it('should successfully create resource without expirationDate if category is not food/medicine', async () => {
      const mockResource = {
        id: 'resource-456',
        name: 'Voluntario',
        category: ResourceCategory.HELPERS,
        stockQuantity: 2,
        expirationDate: null,
      };

      mockPrisma.resource.create.mockResolvedValue(mockResource);
      mockPrisma.stockTransaction.create.mockResolvedValue({});

      const result = await service.createResource({
        name: 'Voluntario',
        category: ResourceCategory.HELPERS,
        stockQuantity: 2,
      });

      expect(result).toEqual(mockResource);
      expect(mockPrisma.resource.create).toHaveBeenCalled();
    });
  });

  describe('checkExpirationJob', () => {
    it('should reset stock to 0 for expired resources', async () => {
      const mockExpiredResources = [
        {
          id: 'res-expired-1',
          name: 'Leche Vencida',
          category: ResourceCategory.FOOD,
          stockQuantity: 50,
          expirationDate: new Date(Date.now() - 10000),
        },
      ];

      mockPrisma.resource.findMany.mockResolvedValue(mockExpiredResources);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'res-expired-1',
          name: 'Leche Vencida',
          category: ResourceCategory.FOOD,
          stockQuantity: 50,
        },
      ]);
      mockPrisma.resource.update.mockResolvedValue({
        id: 'res-expired-1',
        stockQuantity: 0,
      });

      await service.checkExpirationJob();

      expect(mockPrisma.resource.findMany).toHaveBeenCalled();
      // adjustStock should be called under the hood (mockPrisma.resource.update & stockTransaction.create)
      expect(mockPrisma.resource.update).toHaveBeenCalledWith({
        where: { id: 'res-expired-1' },
        data: { stockQuantity: 0 },
      });
      expect(mockPrisma.stockTransaction.create).toHaveBeenCalledWith({
        data: {
          resourceId: 'res-expired-1',
          quantity: -50,
          description: 'Ajuste automático por fecha de vencimiento expirada',
        },
      });
    });
  });
});
