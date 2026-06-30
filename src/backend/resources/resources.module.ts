import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [ItemsModule],
  providers: [ResourcesService],
  controllers: [ResourcesController],
  exports: [ResourcesService],
})
export class ResourcesModule {}
