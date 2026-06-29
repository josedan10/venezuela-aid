import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { FirebaseAuthGuard } from '../users/firebase-auth.guard';

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
}
