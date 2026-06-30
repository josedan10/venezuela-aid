import { Injectable, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ItemsService } from '../items/items.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourceCategory, Resource } from '@prisma/client';

@Injectable()
export class ResourcesService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private itemsService: ItemsService,
  ) {}

  onModuleInit() {
    // Start the periodic expiration check (simulating a cron job every 12 hours)
    setInterval(() => {
      this.checkExpirationJob().catch(err => {
        console.error('Error in expiration check job:', err);
      });
    }, 12 * 60 * 60 * 1000); // 12 hours
  }

  async createResource(dto: CreateResourceDto, donorId?: string | null) {
    let itemId = dto.itemId;
    let name = dto.name?.trim();
    let category = dto.category;

    if (itemId) {
      const catalogItem = await this.itemsService.findById(itemId);
      if (!catalogItem) {
        throw new BadRequestException('El ítem del catálogo no existe.');
      }
      name = catalogItem.name;
      category = catalogItem.category;
    } else if (name && category) {
      const catalogItem = await this.itemsService.findOrCreate(name, category);
      itemId = catalogItem.id;
      name = catalogItem.name;
      category = catalogItem.category;
    } else {
      throw new BadRequestException('Debe indicar itemId o nombre y categoría del ítem.');
    }

    const isFoodOrMed = category === ResourceCategory.FOOD || category === ResourceCategory.MEDICINES;

    let parsedExpDate: Date | null = null;
    if (isFoodOrMed) {
      if (!dto.expirationDate) {
        throw new BadRequestException('La fecha de vencimiento es obligatoria para Alimentos y Medicamentos.');
      }
      parsedExpDate = new Date(dto.expirationDate);
      const now = new Date();
      if (parsedExpDate.getTime() < now.getTime()) {
        throw new BadRequestException('No se pueden registrar recursos con fecha de vencimiento pasada.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let latitude = dto.latitude ?? null;
      let longitude = dto.longitude ?? null;

      if (dto.collectionCenterId) {
        const center = await tx.collectionCenter.findUnique({
          where: { id: dto.collectionCenterId },
        });
        if (!center) {
          throw new BadRequestException('El centro de acopio indicado no existe.');
        }
        latitude = center.latitude;
        longitude = center.longitude;
      }

      const resource = await tx.resource.create({
        data: {
          itemId,
          name,
          category,
          stockQuantity: dto.stockQuantity,
          expirationDate: parsedExpDate,
          donorId: donorId ?? null,
          latitude,
          longitude,
          collectionCenterId: dto.collectionCenterId ?? null,
        },
        include: {
          item: true,
          donor: { select: { name: true } },
          collectionCenter: { select: { name: true, latitude: true, longitude: true } },
        },
      });

      if (dto.stockQuantity > 0) {
        await tx.stockTransaction.create({
          data: {
            resourceId: resource.id,
            quantity: dto.stockQuantity,
            description: 'Carga inicial - Registro de recurso',
          },
        });
      }

      return resource;
    });
  }

  async adjustStock(resourceId: string, quantity: number, description: string) {
    return this.prisma.$transaction(async (tx) => {
      // Row level locking via raw MySQL select FOR UPDATE
      const resources = await tx.$queryRaw<Resource[]>`
        SELECT * FROM Resource WHERE id = ${resourceId} FOR UPDATE
      `;

      if (!resources || resources.length === 0) {
        throw new NotFoundException('Recurso no encontrado.');
      }

      const resource = resources[0];
      const newQuantity = resource.stockQuantity + quantity;

      if (newQuantity < 0) {
        throw new BadRequestException('Cantidad de stock insuficiente.');
      }

      // Update resource quantity
      const updatedResource = await tx.resource.update({
        where: { id: resourceId },
        data: { stockQuantity: newQuantity },
      });

      // Log transaction
      await tx.stockTransaction.create({
        data: {
          resourceId,
          quantity,
          description,
        },
      });

      return updatedResource;
    });
  }

  async getResourceById(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
    });
    if (!resource) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return resource;
  }

  async listResources() {
    return this.prisma.resource.findMany({
      include: {
        item: true,
        donor: { select: { id: true, name: true } },
        collectionCenter: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSoonToExpire(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    return this.prisma.resource.findMany({
      where: {
        expirationDate: {
          gte: new Date(),
          lte: cutoffDate,
        },
      },
      orderBy: { expirationDate: 'asc' },
    });
  }

  async checkExpirationJob() {
    console.log('[CRON] Ejecutando verificación de vencimiento de recursos...');
    const now = new Date();
    const expiredResources = await this.prisma.resource.findMany({
      where: {
        expirationDate: {
          lt: now,
        },
        stockQuantity: {
          gt: 0,
        },
      },
    });

    for (const res of expiredResources) {
      console.warn(`[WARNING] Recurso vencido detectado: ${res.name} (ID: ${res.id}, Venció el: ${res.expirationDate}). Ajustando stock a 0.`);
      await this.adjustStock(res.id, -res.stockQuantity, 'Ajuste automático por fecha de vencimiento expirada');
    }
  }
}
