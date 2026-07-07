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

  @UseGuards(FirebaseAuthGuard)
  @Post('propose')
  async propose(@Request() req: any, @Body() body: { needId: string }) {
    return this.dispatchService.createDispatchTask(body.needId, req.user.id);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('accept')
  async accept(@Request() req: any, @Body() body: { taskId: string }) {
    return this.dispatchService.acceptDispatchTask(req.user.id, body.taskId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('reject')
  async reject(@Request() req: any, @Body() body: { taskId: string }) {
    return this.dispatchService.rejectDispatchTask(req.user.id, body.taskId);
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('confirm')
  async confirm(@Request() req: any, @Body() body: { taskId: string; signatureUrl?: string; photoUrl?: string }) {
    const dto = new ConfirmDeliveryDto();
    dto.signatureUrl = body.signatureUrl;
    dto.photoUrl = body.photoUrl;
    return this.dispatchService.confirmDelivery(req.user.id, body.taskId, dto);
  }
}
