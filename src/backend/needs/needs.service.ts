import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNeedDto } from './dto/create-need.dto';
import { NeedStatus } from '@prisma/client';

@Injectable()
export class NeedsService {
  constructor(private prisma: PrismaService) {}

  async createNeed(ngoId: string, dto: CreateNeedDto) {
    // 1. Calculate Priority Score (1-100)
    // Base score from urgencyRating:
    // 1 -> 20, 2 -> 40, 3 -> 60, 4 -> 80, 5 -> 95
    let urgencyScore = dto.urgencyRating * 18;
    if (dto.urgencyRating === 5) {
      urgencyScore = 95;
    }

    if (urgencyScore > 100) urgencyScore = 100;
    if (urgencyScore < 1) urgencyScore = 1;

    const isImmediate = urgencyScore >= 80;

    // 2. Create Need and associated items
    const need = await this.prisma.need.create({
      data: {
        ngoId,
        description: dto.description,
        urgencyScore,
        isImmediate,
        state: dto.state,
        sector: dto.sector,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: NeedStatus.PENDING,
        items: {
          create: dto.items.map((item) => ({
            resourceId: item.resourceId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { resource: true },
        },
        ngo: true,
      },
    });

    const message = isImmediate
      ? 'Solicitud registrada con prioridad crítica.'
      : 'Solicitud registrada exitosamente.';

    return {
      message,
      need,
    };
  }

  async getPrioritizedQueue() {
    return this.prisma.need.findMany({
      where: {
        status: NeedStatus.PENDING,
      },
      include: {
        items: {
          include: { resource: true },
        },
        ngo: true,
      },
      orderBy: [
        { isImmediate: 'desc' },
        { urgencyScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getNeedById(id: string) {
    const need = await this.prisma.need.findUnique({
      where: { id },
      include: {
        items: {
          include: { resource: true },
        },
        ngo: true,
      },
    });

    if (!need) {
      throw new NotFoundException('Necesidad no encontrada.');
    }

    return need;
  }
}
