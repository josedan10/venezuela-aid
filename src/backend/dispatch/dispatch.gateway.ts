import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchService } from './dispatch.service';
import { GPSCoordinateDto, UpdateGPSBatchDto } from './dto/update-gps.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class DispatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track online sockets: driverId -> Socket ID
  private activeDriverSockets = new Map<string, string>();
  // Reverse mapping: Socket ID -> driverId
  private socketToDriverMap = new Map<string, string>();

  // Track any general user socket connections (for team members location updates)
  private activeUserSockets = new Map<string, string>();
  private socketToUserMap = new Map<string, string>();

  constructor(
    private redisService: RedisService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => DispatchService))
    private dispatchService: DispatchService,
  ) {}

  async handleConnection(socket: Socket) {
    const driverId = socket.handshake.query.driverId as string;
    const userId = socket.handshake.query.userId as string;

    if (driverId) {
      this.activeDriverSockets.set(driverId, socket.id);
      this.socketToDriverMap.set(socket.id, driverId);
      console.log(`[SOCKET] Conductor conectado: ID=${driverId}, SocketID=${socket.id}`);
      
      // Update availability in Redis when connecting
      await this.redisService.setDriverAvailability(driverId, true);
    }

    if (userId) {
      this.activeUserSockets.set(userId, socket.id);
      this.socketToUserMap.set(socket.id, userId);
      console.log(`[SOCKET] Usuario conectado: ID=${userId}, SocketID=${socket.id}`);
    }

    if (!driverId && !userId) {
      console.log(`[SOCKET] Cliente genérico conectado: SocketID=${socket.id}`);
    }
  }

  async handleDisconnect(socket: Socket) {
    const driverId = this.socketToDriverMap.get(socket.id);
    if (driverId) {
      this.activeDriverSockets.delete(driverId);
      this.socketToDriverMap.delete(socket.id);
      console.log(`[SOCKET] Conductor desconectado: ID=${driverId}, SocketID=${socket.id}`);
      
      // Set offline state when disconnecting
      await this.redisService.setDriverAvailability(driverId, false);
      await this.redisService.removeDriverLocation(driverId);
    }

    const userId = this.socketToUserMap.get(socket.id);
    if (userId) {
      this.activeUserSockets.delete(userId);
      this.socketToUserMap.delete(socket.id);
      console.log(`[SOCKET] Usuario desconectado: ID=${userId}, SocketID=${socket.id}`);
    }

    if (!driverId && !userId) {
      console.log(`[SOCKET] Cliente genérico desconectado: SocketID=${socket.id}`);
    }
  }

  // Handle subscription to team live locations
  @SubscribeMessage('join_team')
  async handleJoinTeam(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { teamId: string },
  ) {
    if (data.teamId) {
      await socket.join(`team:${data.teamId}`);
      console.log(`[SOCKET] Socket ${socket.id} se unió a la sala del equipo: team:${data.teamId}`);
      socket.emit('team_joined', { teamId: data.teamId });
    }
  }

  // Single GPS coordinate stream event
  @SubscribeMessage('location_update')
  async handleLocationUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: GPSCoordinateDto,
  ) {
    const driverId = this.socketToDriverMap.get(socket.id);
    const userId = this.socketToUserMap.get(socket.id) || driverId;

    if (!userId) {
      socket.emit('error', 'No autenticado.');
      return;
    }

    // Save location to Redis (for drivers & general users)
    if (driverId) {
      await this.redisService.updateDriverLocation(driverId, data.latitude, data.longitude);
      this.dispatchService.registerDriverUpdate(driverId);
      console.log(`[LOCATION] Ubicación de conductor ${driverId}: Lat=${data.latitude}, Lng=${data.longitude}`);
    }

    // Cache generic user location
    await this.redisService.updateUserLocation(userId, data.latitude, data.longitude);

    // Broadcast location to team members if user belongs to a team and has location sharing enabled
    await this.broadcastToTeam(userId, data.latitude, data.longitude);

    socket.emit('location_received', { status: 'ok', timestamp: new Date().toISOString() });
  }

  // Batch GPS coordinate sync (from IndexedDB offline buffering)
  @SubscribeMessage('location_batch')
  async handleLocationBatch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: UpdateGPSBatchDto,
  ) {
    const driverId = this.socketToDriverMap.get(socket.id);
    const userId = this.socketToUserMap.get(socket.id) || driverId;

    if (!userId) {
      socket.emit('error', 'No autenticado.');
      return;
    }

    if (!data.coordinates || !Array.isArray(data.coordinates) || data.coordinates.length === 0) {
      socket.emit('error', 'El lote de coordenadas está vacío o no es válido.');
      return;
    }

    // Sort coordinates chronologically
    const sortedCoords = [...data.coordinates].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    console.log(`[LOCATION_BATCH] Procesando lote de ${sortedCoords.length} coordenadas para ID=${userId}`);

    for (const coord of sortedCoords) {
      if (driverId) {
        await this.redisService.updateDriverLocation(driverId, coord.latitude, coord.longitude);
      }
      await this.redisService.updateUserLocation(userId, coord.latitude, coord.longitude);
    }

    if (driverId) {
      this.dispatchService.registerDriverUpdate(driverId);
    }

    // Broadcast the latest coordinate to the team
    const latest = sortedCoords[sortedCoords.length - 1];
    await this.broadcastToTeam(userId, latest.latitude, latest.longitude);

    socket.emit('batch_received', { status: 'ok', count: sortedCoords.length });
  }

  private async broadcastToTeam(userId: string, latitude: number, longitude: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, teamId: true, shareLocationWithTeam: true },
      });

      if (user && user.teamId && user.shareLocationWithTeam) {
        // Broadcast location update to team room
        this.server.to(`team:${user.teamId}`).emit('team_location_update', {
          userId: user.id,
          name: user.name,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error broadcasting team location:', err);
    }
  }

  // Emits invitation to driver
  sendProposalToDriver(driverId: string, payload: { taskId: string; description: string; timeoutSeconds: number }) {
    const socketId = this.activeDriverSockets.get(driverId);
    if (socketId) {
      this.server.to(socketId).emit('dispatch_proposal', payload);
      console.log(`[PROPOSAL] Propuesta de despacho emitida a conductor ${driverId}`);
    } else {
      console.warn(`[PROPOSAL] El conductor ${driverId} no está conectado a Socket.io. No se pudo enviar propuesta.`);
    }
  }

  // Notify operators that driver signal has been lost in transit
  notifyOperatorsConnectionLost(driverId: string, taskId: string) {
    console.warn(`[SOCKET ALERTA] Conductor ${driverId} ha perdido la señal para despacho ${taskId}. Notificando operarios.`);
    this.server.emit('operator_alert', {
      driverId,
      taskId,
      message: 'El conductor ha perdido la señal hace más de 5 minutos.',
    });
  }
}
