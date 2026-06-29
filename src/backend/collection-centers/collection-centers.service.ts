import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionCenterDto } from './dto/create-collection-center.dto';

@Injectable()
export class CollectionCentersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCollectionCenterDto, userId?: string) {
    return this.prisma.collectionCenter.create({
      data: {
        name: dto.name,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        services: dto.services,
        createdById: userId || null,
      },
    });
  }

  async findAll() {
    return this.prisma.collectionCenter.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
