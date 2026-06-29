import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  async create(@Body() dto: CreateResourceDto) {
    const resource = await this.resourcesService.createResource(dto);
    return {
      message: 'Recurso registrado exitosamente.',
      resource,
    };
  }

  @Get()
  async findAll() {
    return this.resourcesService.listResources();
  }

  @Get('soon-to-expire')
  async getSoonToExpire(@Query('days') days?: string) {
    const limitDays = days ? parseInt(days, 10) : 30;
    return this.resourcesService.getSoonToExpire(limitDays);
  }

  @Post('adjust-stock')
  async adjustStock(@Body() body: { resourceId: string; quantity: number; description: string }) {
    const resource = await this.resourcesService.adjustStock(body.resourceId, body.quantity, body.description);
    return {
      message: 'Stock ajustado exitosamente.',
      resource,
    };
  }
}
