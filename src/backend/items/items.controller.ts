import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { ResourceCategory } from '@prisma/client';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async search(
    @Query('q') q?: string,
    @Query('category') category?: ResourceCategory,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 25;
    return this.itemsService.search(q, category, parsedLimit);
  }

  @Post()
  async create(@Body() dto: CreateItemDto) {
    const item = await this.itemsService.create(dto);
    return {
      message: 'Ítem registrado en el catálogo.',
      item,
    };
  }
}
