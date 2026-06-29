import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { CollectionCentersService } from './collection-centers.service';
import { CreateCollectionCenterDto } from './dto/create-collection-center.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('collection-centers')
export class CollectionCentersController {
  constructor(
    private readonly service: CollectionCentersService,
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateCollectionCenterDto) {
    let userId: string | undefined = undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token) {
        try {
          const decodedToken = await this.firebaseService.getAuth().verifyIdToken(token);
          const user = await this.prisma.user.findUnique({
            where: { firebaseId: decodedToken.uid },
          });
          if (user) {
            userId = user.id;
          }
        } catch (e) {
          // Gracefully fallback to anonymous registration if token is invalid
        }
      }
    }

    return this.service.create(dto, userId);
  }

  @Get()
  async findAll() {
    return this.service.findAll();
  }
}
