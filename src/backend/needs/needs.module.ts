import { Module } from '@nestjs/common';
import { NeedsService } from './needs.service';
import { NeedsController } from './needs.controller';

@Module({
  providers: [NeedsService],
  controllers: [NeedsController],
  exports: [NeedsService],
})
export class NeedsModule {}
