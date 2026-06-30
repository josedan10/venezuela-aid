import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { NeedsService } from './needs.service';
import { CreateNeedRequestDto } from './dto/create-need-request.dto';

@Controller('needs')
export class NeedsController {
  constructor(private readonly needsService: NeedsService) {}

  @Post()
  async create(@Body() body: CreateNeedRequestDto) {
    const { ngoId, ...dto } = body;
    return this.needsService.createNeed(ngoId, dto);
  }

  @Get()
  async getQueue() {
    return this.needsService.getPrioritizedQueue();
  }

  @Get('nearby')
  async getNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Los parámetros lat y lng son obligatorios y deben ser números válidos.');
    }

    const radiusKm = radius != null && radius !== '' ? Number(radius) : 15;
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      throw new BadRequestException('El parámetro radius debe ser un número mayor que 0.');
    }

    return this.needsService.getNearbyNeeds(latitude, longitude, radiusKm);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.needsService.getNeedById(id);
  }
}
