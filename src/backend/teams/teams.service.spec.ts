import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamDeliveryPolicy, TeamDriverAccessStatus, TeamRole } from '@prisma/client';

describe('TeamsService', () => {
  let service: TeamsService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teamDriverAccess: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRedis = {
    getUserLocation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTeam', () => {
    it('should successfully create a new team and associate creator as member', async () => {
      const mockUser = { id: 'user-1', name: 'User One', teamId: null };
      const mockCreatedTeam = { id: 'team-1', name: 'Alfas', creatorId: 'user-1' };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.team.create.mockResolvedValue(mockCreatedTeam);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.createTeam('user-1', 'Alfas', 'Equipo alfa de ayuda');

      expect(result.message).toBe('Equipo creado con éxito.');
      expect(result.team).toEqual(mockCreatedTeam);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          name: 'Alfas',
          description: 'Equipo alfa de ayuda',
          creatorId: 'user-1',
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { teamId: 'team-1', teamRole: TeamRole.MANAGER },
      });
    });

    it('should throw BadRequestException if user already belongs to another team', async () => {
      const mockUser = { id: 'user-1', name: 'User One', teamId: 'other-team-id' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.createTeam('user-1', 'Alfas')).rejects.toThrow(
        new BadRequestException('Ya eres miembro de otro equipo. Debes salir de él antes de crear uno nuevo.'),
      );
    });
  });

  describe('joinTeam', () => {
    it('should successfully join an existing team', async () => {
      const mockUser = { id: 'user-2', name: 'User Two', teamId: null };
      const mockTeam = { id: 'team-2', name: 'Betas' };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.joinTeam('user-2', 'team-2');

      expect(result.message).toBe('Te has unido al equipo con éxito.');
      expect(result.team).toEqual(mockTeam);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { teamId: 'team-2', teamRole: TeamRole.COLLABORATOR },
      });
    });
  });

  describe('leaveTeam', () => {
    it('should remove user from their current team and disable location sharing', async () => {
      const mockUser = { id: 'user-2', name: 'User Two', teamId: 'team-2' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.leaveTeam('user-2');

      expect(result.message).toBe('Has salido del equipo con éxito.');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { teamId: null, shareLocationWithTeam: false, teamRole: TeamRole.COLLABORATOR },
      });
    });
  });

  describe('toggleLocationSharing', () => {
    it('should update sharing preferences if user belongs to a team', async () => {
      const mockUser = { id: 'user-3', name: 'User Three', teamId: 'team-3' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ shareLocationWithTeam: true });

      const result = await service.toggleLocationSharing('user-3', true);

      expect(result.shareLocationWithTeam).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-3' },
        data: { shareLocationWithTeam: true },
      });
    });

    it('should throw BadRequestException if user is not in a team', async () => {
      const mockUser = { id: 'user-3', name: 'User Three', teamId: null };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.toggleLocationSharing('user-3', true)).rejects.toThrow(
        new BadRequestException('Debes unirte a un equipo antes de compartir tu ubicación.'),
      );
    });
  });

  describe('team settings and driver access', () => {
    it('should update team settings for the manager', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        teamId: 'team-1',
        teamRole: TeamRole.MANAGER,
        team: { id: 'team-1', creatorId: 'user-1' },
      });
      mockPrisma.team.update.mockResolvedValue({
        id: 'team-1',
        name: 'Nuevo nombre',
        description: 'Nueva desc',
        deliveryPolicy: TeamDeliveryPolicy.TEAM_AND_APPROVED_EXTERNAL,
      });

      const result = await service.updateMyTeamSettings('user-1', {
        name: 'Nuevo nombre',
        description: 'Nueva desc',
        deliveryPolicy: TeamDeliveryPolicy.TEAM_AND_APPROVED_EXTERNAL,
      });

      expect(result.message).toBe('Ajustes del equipo actualizados con éxito.');
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: {
          name: 'Nuevo nombre',
          description: 'Nueva desc',
          deliveryPolicy: TeamDeliveryPolicy.TEAM_AND_APPROVED_EXTERNAL,
        },
      });
    });

    it('should approve a driver access request for the manager', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          teamId: 'team-1',
          teamRole: TeamRole.MANAGER,
          team: { id: 'team-1', creatorId: 'user-1' },
        })
        .mockResolvedValueOnce({
          id: 'driver-1',
          roles: 'DRIVER',
        });
      mockPrisma.teamDriverAccess.upsert.mockResolvedValue({
        id: 'access-1',
        teamId: 'team-1',
        driverId: 'driver-1',
        status: TeamDriverAccessStatus.APPROVED,
      });

      const result = await service.approveDriverAccess('user-1', 'driver-1');

      expect(result.message).toBe('El conductor fue aprobado para este equipo.');
      expect(prisma.teamDriverAccess.upsert).toHaveBeenCalledWith({
        where: {
          teamId_driverId: {
            teamId: 'team-1',
            driverId: 'driver-1',
          },
        },
        create: {
          teamId: 'team-1',
          driverId: 'driver-1',
          status: TeamDriverAccessStatus.APPROVED,
          approvedById: 'user-1',
        },
        update: {
          status: TeamDriverAccessStatus.APPROVED,
          approvedById: 'user-1',
        },
      });
    });

    it('should reject approval when the target user is not a driver', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          teamId: 'team-1',
          teamRole: TeamRole.MANAGER,
          team: { id: 'team-1', creatorId: 'user-1' },
        })
        .mockResolvedValueOnce({
          id: 'user-x',
          roles: 'DONOR',
        });

      await expect(service.approveDriverAccess('user-1', 'user-x')).rejects.toThrow(
        new BadRequestException('El usuario indicado no tiene rol de conductor.'),
      );
      expect(prisma.teamDriverAccess.upsert).not.toHaveBeenCalled();
    });

    it('should reject driver access changes when the target user is not a driver', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'user-1',
          teamId: 'team-1',
          teamRole: TeamRole.MANAGER,
          team: { id: 'team-1', creatorId: 'user-1' },
        })
        .mockResolvedValueOnce({
          id: 'user-y',
          roles: 'DONOR',
        });

      await expect(service.rejectDriverAccess('user-1', 'user-y')).rejects.toThrow(
        new BadRequestException('El usuario indicado no tiene rol de conductor.'),
      );
      expect(prisma.teamDriverAccess.upsert).not.toHaveBeenCalled();
    });
  });
});
