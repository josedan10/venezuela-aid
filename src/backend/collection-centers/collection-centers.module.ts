import { Module } from '@nestjs/common';
import { CollectionCentersService } from './collection-centers.service';
import { CollectionCentersController } from './collection-centers.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [CollectionCentersService],
  controllers: [CollectionCentersController],
  exports: [CollectionCentersService],
})
export class CollectionCentersModule {}
