import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { ResourceCategory } from '@prisma/client';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async search(query?: string, category?: ResourceCategory, limit = 25) {
    const trimmed = query?.trim();
    const parsedLimit = Number(limit);
    const take = Math.min(
      Math.max(Number.isFinite(parsedLimit) ? Math.floor(parsedLimit) : 25, 1),
      50,
    );

    return this.prisma.item.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(trimmed
          ? {
              name: {
                contains: trimmed,
              },
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take,
    });
  }

  async findById(id: string) {
    return this.prisma.item.findUnique({ where: { id } });
  }

  async create(dto: CreateItemDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('El nombre del ítem no puede estar vacío.');
    }

    const existing = await this.prisma.item.findUnique({
      where: {
        name_category: { name, category: dto.category },
      },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.item.create({
        data: { name, category: dto.category },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un ítem con ese nombre en la categoría seleccionada.');
      }
      throw error;
    }
  }

  /** Find existing catalog item or create a new one (for autocomplete "add new"). */
  async findOrCreate(name: string, category: ResourceCategory) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new ConflictException('El nombre del ítem no puede estar vacío.');
    }

    const existing = await this.prisma.item.findUnique({
      where: { name_category: { name: trimmed, category } },
    });
    if (existing) return existing;

    return this.prisma.item.create({
      data: { name: trimmed, category },
    });
  }
}
