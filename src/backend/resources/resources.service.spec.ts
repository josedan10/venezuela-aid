import { Test, TestingModule } from '@nestjs/testing';
import { ResourcesService } from './resources.service';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from '../items/items.service';
import { BadRequestException } from '@nestjs/common';
import { ResourceCategory } from '@prisma/client';

describe('ResourcesService', () => {
  let service: ResourcesService;

  const mockItemsService = {
    findById: jest.fn(),
    findOrCreate: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn(),
    collectionCenter: {
      findUnique: jest.fn(),
    },
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
        {
          provide: ItemsService,
          useValue: mockItemsService,
        },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
    jest.clearAllMocks();
  });

  describe('createResource', () => {
    it('should throw BadRequestException if FOOD category lacks expirationDate', async () => {
      mockItemsService.findOrCreate.mockResolvedValue({
        id: 'item-1',
        name: 'Arroz',
        category: ResourceCategory.FOOD,
      });

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

      mockItemsService.findOrCreate.mockResolvedValue({
        id: 'item-2',
        name: 'Paracetamol',
        category: ResourceCategory.MEDICINES,
      });

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

      const catalogItem = {
        id: 'item-3',
        name: 'Paracetamol',
        category: ResourceCategory.MEDICINES,
      };

      const mockResource = {
        id: 'resource-123',
        itemId: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        stockQuantity: 5,
        expirationDate: futureDate,
      };

      mockItemsService.findById.mockResolvedValue(catalogItem);
      mockPrisma.resource.create.mockResolvedValue(mockResource);
      mockPrisma.stockTransaction.create.mockResolvedValue({});

      const result = await service.createResource({
        itemId: catalogItem.id,
        stockQuantity: 5,
        expirationDate: futureDate.toISOString(),
      });

      expect(result).toEqual(mockResource);
      expect(mockPrisma.resource.create).toHaveBeenCalled();
    });

    it('should successfully create resource without expirationDate if category is not food/medicine', async () => {
      const catalogItem = {
        id: 'item-4',
        name: 'Voluntario',
        category: ResourceCategory.HELPERS,
      };

      const mockResource = {
        id: 'resource-456',
        itemId: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        stockQuantity: 2,
        expirationDate: null,
      };

      mockItemsService.findOrCreate.mockResolvedValue(catalogItem);
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
