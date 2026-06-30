import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { CompleteDriverProfileDto } from './dto/complete-driver-profile.dto';
import { FirebaseAuthGuard } from './firebase-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return {
      user: req.user,
    };
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('complete-driver-profile')
  async completeDriverProfile(@Request() req: any, @Body() body: CompleteDriverProfileDto) {
    return this.usersService.completeDriverProfile(req.user.id, body);
  }

  @Get('drivers/pending')
  async listPendingDrivers() {
    return this.usersService.listPendingDrivers();
  }

  @Get('drivers/fleet')
  async listFleet() {
    return this.usersService.listFleet();
  }

  @UseGuards(FirebaseAuthGuard)
  @Post('save-selfie')
  async saveSelfie(@Request() req: any, @Body() body: any) {
    return this.usersService.saveSelfie(req.user.id, body.selfieUrl);
  }

  @Post('approve-driver/:id')
  async approveDriver(@Param('id') driverId: string) {
    return this.usersService.approveDriver(driverId);
  }

  @Post('toggle-availability')
  async toggleAvailability(@Body() body: any) {
    return this.usersService.toggleAvailability(body.driverId, body.available);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() body: any) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @UseGuards(FirebaseAuthGuard)
  @Patch('alert-radius')
  async updateAlertRadius(@Request() req: any, @Body() body: { alertRadiusKm: number }) {
    return this.usersService.updateAlertRadius(req.user.id, body.alertRadiusKm);
  }
}
