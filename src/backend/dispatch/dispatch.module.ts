import { Module, forwardRef } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchGateway } from './dispatch.gateway';
import { DispatchController } from './dispatch.controller';
import { RedisModule } from '../redis/redis.module';
import { ResourcesModule } from '../resources/resources.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    RedisModule,
    ResourcesModule,
    PrismaModule,
    FirebaseModule,
  ],
  providers: [DispatchService, DispatchGateway],
  controllers: [DispatchController],
  exports: [DispatchService, DispatchGateway],
})
export class DispatchModule {}

