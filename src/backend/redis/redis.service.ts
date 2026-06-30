import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) { }

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    console.log('REDIS URL:', redisUrl);
    this.client = new Redis(redisUrl);
    this.client.on('error', (err) => {
      console.warn('[REDIS] Connection error:', err.message);
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }

  // Driver Availability Helpers
  async setDriverAvailability(driverId: string, available: boolean): Promise<void> {
    const key = `driver:${driverId}:status`;
    await this.client.set(key, available ? 'Disponible' : 'No Disponible');
  }

  async getDriverAvailability(driverId: string): Promise<string> {
    const key = `driver:${driverId}:status`;
    const val = await this.client.get(key);
    return val || 'No Disponible';
  }

  // Driver Location Helpers (using Redis Geo)
  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void> {
    // Key "drivers:locations" stores geo coordinates
    await this.client.geoadd('drivers:locations', longitude, latitude, driverId);
  }

  async removeDriverLocation(driverId: string): Promise<void> {
    await this.client.zrem('drivers:locations', driverId);
  }

  async findNearbyDrivers(latitude: number, longitude: number, radiusKm: number): Promise<string[]> {
    // GEORADIUS key longitude latitude radius km
    // Returns array of driverIds
    const results = await this.client.georadius('drivers:locations', longitude, latitude, radiusKm, 'km');
    return results as string[];
  }

  // General User Location Helpers
  async updateUserLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    const key = `user:${userId}:location`;
    await this.client.set(key, JSON.stringify({ latitude, longitude, updatedAt: new Date().toISOString() }));
  }

  async getUserLocation(userId: string): Promise<{ latitude: number, longitude: number, updatedAt: string } | null> {
    const key = `user:${userId}:location`;
    const val = await this.client.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
}
