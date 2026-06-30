import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { FirebaseModule } from './firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { ResourcesModule } from './resources/resources.module';
import { NeedsModule } from './needs/needs.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { CollectionCentersModule } from './collection-centers/collection-centers.module';
import { TeamsModule } from './teams/teams.module';
import { ItemsModule } from './items/items.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    FirebaseModule,
    UsersModule,
    ItemsModule,
    ResourcesModule,
    NeedsModule,
    DispatchModule,
    CollectionCentersModule,
    TeamsModule,
  ],
})
export class AppModule {}
