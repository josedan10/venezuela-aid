import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Resource, ResourceCategory } from '@prisma/client';
import { getDistanceKm } from '../common/geo.util';

const DEFAULT_MATCH_RADIUS_KM = 50;

type ResourceWithRelations = Resource & {
  donor?: { name: string } | null;
  collectionCenter?: { name: string; latitude: number; longitude: number } | null;
};

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  /** Resolve lat/lng for a resource offer (direct coords or collection center). */
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
    resourceId: string,
    category: ResourceCategory,
    quantity: number,
    originLat: number,
    originLng: number,
    radiusKm = DEFAULT_MATCH_RADIUS_KM,
  ) {
    const candidates = await this.prisma.resource.findMany({
      where: {
        stockQuantity: { gte: quantity },
        OR: [{ id: resourceId }, { category }],
      },
      include: {
        donor: { select: { name: true } },
        collectionCenter: { select: { name: true, latitude: true, longitude: true } },
      },
    });

    let best: { resource: ResourceWithRelations; distanceKm: number; label: string } | null = null;

    for (const resource of candidates) {
      const loc = this.resolveResourceLocation(resource);
      if (!loc) continue;

      const distanceKm = getDistanceKm(originLat, originLng, loc.lat, loc.lng);
      if (distanceKm > radiusKm) continue;

      const exactMatch = resource.id === resourceId;
      const score = distanceKm - (exactMatch ? 5 : 0); // prefer exact resource within same distance

      if (!best || score < best.distanceKm - (best.resource.id === resourceId ? 5 : 0)) {
        best = { resource, distanceKm, label: loc.label };
      }
    }

    return best;
  }

  /** Match need items to nearest donor/center offers around the origin point. */
  async matchResourcesForNeed(needId: string) {
    const need = await this.prisma.need.findUnique({
      where: { id: needId },
      include: {
        items: { include: { resource: true } },
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
        item.resourceId,
        item.resource.category,
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
