import { Module } from '@nestjs/common';
import { NeedsService } from './needs.service';
import { NeedsController } from './needs.controller';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [MatchingModule],
  providers: [NeedsService],
  controllers: [NeedsController],
  exports: [NeedsService],
})
export class NeedsModule {}
