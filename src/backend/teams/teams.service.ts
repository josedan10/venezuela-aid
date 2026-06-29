import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async createTeam(creatorId: string, name: string, description?: string) {
    if (!name) {
      throw new BadRequestException('El nombre del equipo es obligatorio.');
    }

    // A user can only belong to one team at a time for simplicity
    const user = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!user) {
      throw new NotFoundException('Usuario creador no encontrado.');
    }

    if (user.teamId) {
      throw new BadRequestException('Ya eres miembro de otro equipo. Debes salir de él antes de crear uno nuevo.');
    }

    const team = await this.prisma.team.create({
      data: {
        name,
        description,
        creatorId,
      },
    });

    // Automatically join the newly created team
    await this.prisma.user.update({
      where: { id: creatorId },
      data: { teamId: team.id },
    });

    return {
      message: 'Equipo creado con éxito.',
      team,
    };
  }

  async getAvailableTeams() {
    return this.prisma.team.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        creator: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async joinTeam(userId: string, teamId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (user.teamId) {
      throw new BadRequestException('Ya eres miembro de un equipo. Sal de él primero.');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Equipo no encontrado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId },
    });

    return {
      message: 'Te has unido al equipo con éxito.',
      team,
    };
  }

  async leaveTeam(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.teamId) {
      throw new BadRequestException('No eres miembro de ningún equipo.');
    }

    // If the creator leaves, we could delete the team or assign a new creator.
    // For simplicity, we just clear the teamId of the user. If they are the creator, they can still leave,
    // but the team remains.
    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null, shareLocationWithTeam: false },
    });

    return {
      message: 'Has salido del equipo con éxito.',
    };
  }

  async toggleLocationSharing(userId: string, share: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.teamId) {
      throw new BadRequestException('Debes unirte a un equipo antes de compartir tu ubicación.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { shareLocationWithTeam: share },
    });

    return {
      message: share 
        ? 'Ahora estás compartiendo tu ubicación en tiempo real con los miembros de tu equipo.' 
        : 'Has dejado de compartir tu ubicación con tu equipo.',
      shareLocationWithTeam: updatedUser.shareLocationWithTeam,
    };
  }

  async getMyTeamDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        team: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                roles: true,
                shareLocationWithTeam: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.team) {
      return { inTeam: false };
    }

    // Hydrate members' locations from Redis
    const membersWithLocations = await Promise.all(
      user.team.members.map(async (member) => {
        let location = null;
        if (member.shareLocationWithTeam) {
          location = await this.redisService.getUserLocation(member.id);
        }
        return {
          ...member,
          location,
        };
      }),
    );

    return {
      inTeam: true,
      team: {
        id: user.team.id,
        name: user.team.name,
        description: user.team.description,
        creatorId: user.team.creatorId,
        members: membersWithLocations,
      },
      shareLocationWithTeam: user.shareLocationWithTeam,
    };
  }
}
