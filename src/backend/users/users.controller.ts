import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
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

  @Post('approve-driver/:id')
  async approveDriver(@Param('id') driverId: string) {
    return this.usersService.approveDriver(driverId);
  }

  @Post('toggle-availability')
  async toggleAvailability(@Body() body: any) {
    return this.usersService.toggleAvailability(body.driverId, body.available);
  }
}
