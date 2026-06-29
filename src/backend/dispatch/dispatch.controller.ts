import { Controller, Post, Body, Param } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { ConfirmDeliveryDto } from './dto/confirm-delivery.dto';

@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('propose')
  async propose(@Body() body: { needId: string }) {
    return this.dispatchService.createDispatchTask(body.needId);
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
