import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';
import { FirebaseAuthGuard } from '../users/firebase-auth.guard';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @UseGuards(FirebaseAuthGuard)
  @Get('active')
  async getActiveTask(@Request() req: any) {
    return this.dispatchService.getActiveTaskForDriver(req.user.id);
  }

  @Post('propose')
  async propose(@Body() body: { needId: string; targetDriverId?: string }) {
    return this.dispatchService.createDispatchTask(body.needId, body.targetDriverId);
  }


  @Post('accept')
  async accept(@Body() body: { driverId: string; taskId: string }) {
    return this.dispatchService.acceptDispatchTask(body.driverId, body.taskId);
  }

  @Post('reject')
  async reject(@Body() body: { driverId: string; taskId: string }) {
    return this.dispatchService.rejectDispatchTask(body.driverId, body.taskId);
  }

  @Post('confirm')
  async confirm(@Body() body: { driverId: string; taskId: string; signatureUrl?: string; photoUrl?: string }) {
    const dto = new ConfirmDeliveryDto();
    dto.signatureUrl = body.signatureUrl;
    dto.photoUrl = body.photoUrl;
    return this.dispatchService.confirmDelivery(body.driverId, body.taskId, dto);
  }
}
