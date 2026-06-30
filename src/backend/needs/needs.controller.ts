import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { NeedsService } from './needs.service';
import { CreateNeedDto } from './dto/create-need.dto';

@Controller('needs')
export class NeedsController {
  constructor(private readonly needsService: NeedsService) {}

  @Post()
  async create(@Body() body: any) {
    const { ngoId, ...dtoFields } = body;
    const createNeedDto = Object.assign(new CreateNeedDto(), dtoFields);
    return this.needsService.createNeed(ngoId, createNeedDto);
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
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = radius ? parseFloat(radius) : 15;
    return this.needsService.getNearbyNeeds(latitude, longitude, radiusKm);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.needsService.getNeedById(id);
  }
}
