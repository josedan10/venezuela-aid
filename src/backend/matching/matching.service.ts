import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resource, ResourceCategory } from '@prisma/client';
import { getDistanceKm } from '../common/geo.util';

const DEFAULT_MATCH_RADIUS_KM = 50;

type ResourceWithRelations = Resource & {
  item?: { name: string } | null;
  donor?: { name: string } | null;
  collectionCenter?: { name: string; latitude: number; longitude: number } | null;
};

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  resolveResourceLocation(resource: ResourceWithRelations): { lat: number; lng: number; label: string } | null {
    if (resource.latitude != null && resource.longitude != null) {
      const label = resource.collectionCenter?.name
        ?? resource.donor?.name
        ?? resource.name;
      return { lat: resource.latitude, lng: resource.longitude, label };
    }
    if (resource.collectionCenter) {
      return {
        lat: resource.collectionCenter.latitude,
        lng: resource.collectionCenter.longitude,
        label: resource.collectionCenter.name,
      };
    }
    return null;
  }

  async findBestOffer(
    itemId: string,
    category: ResourceCategory,
    quantity: number,
    originLat: number,
    originLng: number,
    radiusKm = DEFAULT_MATCH_RADIUS_KM,
  ) {
    const candidates = await this.prisma.resource.findMany({
      where: {
        stockQuantity: { gte: quantity },
        OR: [{ itemId }, { category }],
      },
      include: {
        item: { select: { name: true } },
        donor: { select: { name: true } },
        collectionCenter: { select: { name: true, latitude: true, longitude: true } },
      },
    });

    let best: { resource: ResourceWithRelations; distanceKm: number; label: string; score: number } | null = null;

    for (const resource of candidates) {
      const loc = this.resolveResourceLocation(resource);
      if (!loc) continue;

      const distanceKm = getDistanceKm(originLat, originLng, loc.lat, loc.lng);
      if (distanceKm > radiusKm) continue;

      const exactItem = resource.itemId === itemId;
      const tier = exactItem ? 0 : 1;
      const score = tier * 1000 + distanceKm;

      if (!best || score < best.score) {
        best = { resource, distanceKm, label: loc.label, score };
      }
    }

    return best ? { resource: best.resource, distanceKm: best.distanceKm, label: best.label } : null;
  }

  async matchResourcesForNeed(needId: string) {
    const need = await this.prisma.need.findUnique({
      where: { id: needId },
      include: {
        items: { include: { item: true } },
        collectionCenter: true,
      },
    });

    if (!need) return null;

    let originLat = need.originLatitude ?? need.latitude ?? null;
    let originLng = need.originLongitude ?? need.longitude ?? null;
    let originLabel = need.originLabel ?? `${need.state} - ${need.sector}`;

    if (need.collectionCenter) {
      originLat = need.collectionCenter.latitude;
      originLng = need.collectionCenter.longitude;
      originLabel = need.collectionCenter.name;
    }

    if (originLat == null || originLng == null) {
      return { needId, matched: 0, total: need.items.length, origin: null };
    }

    await this.prisma.need.update({
      where: { id: needId },
      data: { originLatitude: originLat, originLongitude: originLng, originLabel },
    });

    let matched = 0;
    for (const item of need.items) {
      const offer = await this.findBestOffer(
        item.itemId,
        item.item.category,
        item.quantity,
        originLat,
        originLng,
      );

      if (offer) {
        const loc = this.resolveResourceLocation(offer.resource)!;
        await this.prisma.needItem.update({
          where: { id: item.id },
          data: {
            matchedResourceId: offer.resource.id,
            pickupLatitude: loc.lat,
            pickupLongitude: loc.lng,
            pickupDistanceKm: offer.distanceKm,
            pickupLabel: offer.label,
          },
        });
        matched++;
      }
    }

    return {
      needId,
      matched,
      total: need.items.length,
      origin: { latitude: originLat, longitude: originLng, label: originLabel },
    };
  }
}
