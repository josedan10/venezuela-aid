import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { RedisModule } from '../redis/redis.module';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { AdminRolesGuard } from './admin-roles.guard';

@Module({
  imports: [PrismaModule, FirebaseModule, RedisModule],
  providers: [UsersService, FirebaseAuthGuard, AdminRolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
