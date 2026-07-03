import { Controller, Post, Get, Patch, Body, UseGuards, Request, Param } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { FirebaseAuthGuard } from '../users/firebase-auth.guard';
import { TeamDeliveryPolicy } from '@prisma/client';

@Controller('teams')
@UseGuards(FirebaseAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(@Request() req: any, @Body() body: { name: string; description?: string }) {
    return this.teamsService.createTeam(req.user.id, body.name, body.description);
  }

  @Get()
  async getAvailableTeams() {
    return this.teamsService.getAvailableTeams();
  }

  @Post('join')
  async joinTeam(@Request() req: any, @Body() body: { teamId: string }) {
    return this.teamsService.joinTeam(req.user.id, body.teamId);
  }

  @Post('leave')
  async leaveTeam(@Request() req: any) {
    return this.teamsService.leaveTeam(req.user.id);
  }

  @Post('toggle-sharing')
  async toggleLocationSharing(@Request() req: any, @Body() body: { share: boolean }) {
    return this.teamsService.toggleLocationSharing(req.user.id, body.share);
  }

  @Get('my-team')
  async getMyTeamDetails(@Request() req: any) {
    return this.teamsService.getMyTeamDetails(req.user.id);
  }

  @Get('my-team/settings')
  async getMyTeamSettings(@Request() req: any) {
    return this.teamsService.getMyTeamSettings(req.user.id);
  }

  @Patch('my-team/settings')
  async updateMyTeamSettings(
    @Request() req: any,
    @Body() body: { name?: string; description?: string; deliveryPolicy?: TeamDeliveryPolicy },
  ) {
    return this.teamsService.updateMyTeamSettings(req.user.id, body);
  }

  @Post('driver-access/request')
  async requestDriverAccess(@Request() req: any, @Body() body: { teamId?: string }) {
    return this.teamsService.requestDriverAccess(req.user.id, body.teamId);
  }

  @Get('my-team/driver-access/pending')
  async listPendingDriverAccess(@Request() req: any) {
    return this.teamsService.listPendingDriverAccess(req.user.id);
  }

  @Post('my-team/driver-access/:driverId/approve')
  async approveDriverAccess(@Request() req: any, @Param('driverId') driverId: string) {
    return this.teamsService.approveDriverAccess(req.user.id, driverId);
  }

  @Post('my-team/driver-access/:driverId/reject')
  async rejectDriverAccess(@Request() req: any, @Param('driverId') driverId: string) {
    return this.teamsService.rejectDriverAccess(req.user.id, driverId);
  }
}
