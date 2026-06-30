import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { CreateNeedDto } from './dto/create-need.dto';
import { NeedStatus } from '@prisma/client';
import { getDistanceKm } from '../common/geo.util';

@Injectable()
export class NeedsService {
  constructor(
    private prisma: PrismaService,
    private matchingService: MatchingService,
  ) {}

  async createNeed(ngoId: string, dto: CreateNeedDto) {
    let urgencyScore = dto.urgencyRating * 18;
    if (dto.urgencyRating === 5) {
      urgencyScore = 95;
    }

    if (urgencyScore > 100) urgencyScore = 100;
    if (urgencyScore < 1) urgencyScore = 1;

    const isImmediate = urgencyScore >= 80;

    let originLatitude = dto.latitude ?? null;
    let originLongitude = dto.longitude ?? null;
    let originLabel: string | null = `${dto.state} - ${dto.sector}`;

    if (dto.collectionCenterId) {
      const center = await this.prisma.collectionCenter.findUnique({
        where: { id: dto.collectionCenterId },
      });
      if (!center) {
        throw new BadRequestException('El centro de acopio indicado no existe.');
      }
      originLatitude = center.latitude;
      originLongitude = center.longitude;
      originLabel = center.name;
    }

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
        collectionCenterId: dto.collectionCenterId ?? null,
        originLatitude,
        originLongitude,
        originLabel,
        status: NeedStatus.PENDING,
        items: {
          create: dto.items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: { item: true, matchedResource: { include: { item: true } } },
        },
        ngo: true,
        collectionCenter: true,
      },
    });

    const matchResult = await this.matchingService.matchResourcesForNeed(need.id).catch((err) => {
      console.error(`[NeedsService] Matching failed for need ${need.id}:`, err);
      return {
        needId: need.id,
        matched: 0,
        total: need.items.length,
        error: 'matching_failed',
      };
    });

    const enrichedNeed = await this.getNeedById(need.id);

    const message = isImmediate
      ? 'Solicitud registrada con prioridad crítica.'
      : 'Solicitud registrada exitosamente.';

    return {
      message,
      need: enrichedNeed,
      matching: matchResult,
      urgencyScore: need.urgencyScore,
    };
  }

  async getPrioritizedQueue() {
    return this.prisma.need.findMany({
      where: {
        status: NeedStatus.PENDING,
      },
      include: {
        items: {
          include: { item: true, matchedResource: { include: { item: true } } },
        },
        ngo: true,
        collectionCenter: true,
      },
      orderBy: [
        { isImmediate: 'desc' },
        { urgencyScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async getNearbyNeeds(latitude: number, longitude: number, radiusKm: number) {
    const pending = await this.getPrioritizedQueue();

    return pending
      .filter((need) => {
        const originLat = need.originLatitude ?? need.latitude;
        const originLng = need.originLongitude ?? need.longitude;
        if (originLat == null || originLng == null) return false;
        return getDistanceKm(latitude, longitude, originLat, originLng) <= radiusKm;
      })
      .map((need) => {
        const originLat = need.originLatitude ?? need.latitude!;
        const originLng = need.originLongitude ?? need.longitude!;
        return {
          ...need,
          distanceKm: getDistanceKm(latitude, longitude, originLat, originLng),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async getNeedById(id: string) {
    const need = await this.prisma.need.findUnique({
      where: { id },
      include: {
        items: {
          include: { item: true, matchedResource: { include: { item: true } } },
        },
        ngo: true,
        collectionCenter: true,
      },
    });

    if (!need) {
      throw new NotFoundException('Necesidad no encontrada.');
    }

    return need;
  }
}
