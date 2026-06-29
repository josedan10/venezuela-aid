import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { FirebaseModule } from './firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { ResourcesModule } from './resources/resources.module';
import { NeedsModule } from './needs/needs.module';
import { DispatchModule } from './dispatch/dispatch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    RedisModule,
    FirebaseModule,
    UsersModule,
    ResourcesModule,
    NeedsModule,
    DispatchModule,
  ],
})
export class AppModule {}
