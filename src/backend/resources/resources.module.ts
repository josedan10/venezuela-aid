import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { ItemsModule } from '../items/items.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../users/firebase-auth.guard';

@Module({
  imports: [ItemsModule, PrismaModule, FirebaseModule],
  providers: [ResourcesService, FirebaseAuthGuard],
  controllers: [ResourcesController],
  exports: [ResourcesService],
})
export class ResourcesModule {}
