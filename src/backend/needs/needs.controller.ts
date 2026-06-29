import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { NeedsService } from './needs.service';
import { CreateNeedDto } from './dto/create-need.dto';

@Controller('needs')
export class NeedsController {
  constructor(private readonly needsService: NeedsService) {}

  @Post()
  async create(@Body() body: any) {
    // Extract ngoId and the DTO fields. Accept ngoId inside body for ease of integration.
    const { ngoId, ...dtoFields } = body;
    const createNeedDto = Object.assign(new CreateNeedDto(), dtoFields);
    
    // Call the service
    return this.needsService.createNeed(ngoId, createNeedDto);
  }

  @Get()
  async getQueue() {
    return this.needsService.getPrioritizedQueue();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.needsService.getNeedById(id);
  }
}
