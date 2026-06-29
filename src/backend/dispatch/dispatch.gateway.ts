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

  constructor(
    private redisService: RedisService,
    @Inject(forwardRef(() => DispatchService))
    private dispatchService: DispatchService,
  ) {}

  async handleConnection(socket: Socket) {
    const driverId = socket.handshake.query.driverId as string;
    if (driverId) {
      this.activeDriverSockets.set(driverId, socket.id);
      this.socketToDriverMap.set(socket.id, driverId);
      console.log(`[SOCKET] Conductor conectado: ID=${driverId}, SocketID=${socket.id}`);
      
      // Update availability in Redis when connecting
      await this.redisService.setDriverAvailability(driverId, true);
    } else {
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
    } else {
      console.log(`[SOCKET] Cliente genérico desconectado: SocketID=${socket.id}`);
    }
  }

  // Single GPS coordinate stream event
  @SubscribeMessage('location_update')
  async handleLocationUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: GPSCoordinateDto,
  ) {
    const driverId = this.socketToDriverMap.get(socket.id);
    if (!driverId) {
      socket.emit('error', 'No autenticado como conductor.');
      return;
    }

    // Save location to Redis
    await this.redisService.updateDriverLocation(driverId, data.latitude, data.longitude);

    // Register active heartbeat
    this.dispatchService.registerDriverUpdate(driverId);

    console.log(`[LOCATION] Ubicación de conductor ${driverId}: Lat=${data.latitude}, Lng=${data.longitude}`);
    socket.emit('location_received', { status: 'ok', timestamp: new Date().toISOString() });
  }

  // Batch GPS coordinate sync (from IndexedDB offline buffering)
  @SubscribeMessage('location_batch')
  async handleLocationBatch(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: UpdateGPSBatchDto,
  ) {
    const driverId = this.socketToDriverMap.get(socket.id);
    if (!driverId) {
      socket.emit('error', 'No autenticado como conductor.');
      return;
    }

    if (!data.coordinates || !Array.isArray(data.coordinates) || data.coordinates.length === 0) {
      socket.emit('error', 'El lote de coordenadas está vacío o no es válido.');
      return;
    }

    // Sort coordinates chronologically just in case
    const sortedCoords = [...data.coordinates].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    console.log(`[LOCATION_BATCH] Procesando lote de ${sortedCoords.length} coordenadas para conductor ${driverId}`);

    for (const coord of sortedCoords) {
      // Save location to Redis
      await this.redisService.updateDriverLocation(driverId, coord.latitude, coord.longitude);
    }

    // Register active heartbeat based on the latest coordinate update
    this.dispatchService.registerDriverUpdate(driverId);

    socket.emit('batch_received', { status: 'ok', count: sortedCoords.length });
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
