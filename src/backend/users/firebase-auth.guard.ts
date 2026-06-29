import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decodedToken = await this.firebaseService.getAuth().verifyIdToken(token);
      request.firebaseUser = decodedToken;

      const user = await this.prismaService.user.findUnique({
        where: { firebaseId: decodedToken.uid },
        include: { driverDetails: true },
      });

      if (!user) {
        // If this is a registration path, we might allow it without db user.
        // But to be safe, if they are calling endpoints other than registration, they must exist in the database.
        // We will attach null user so that the controller can decide, or throw.
        // Let's throw for general protected endpoints, but we can check the route.
        const path = request.route?.path || request.url;
        if (path.includes('/users/register') || path.includes('/register')) {
          request.user = null;
          return true;
        }
        throw new NotFoundException('User not registered in database.');
      }

      request.user = user;
      return true;
    } catch (error: any) {
      // Re-throw NestJS HTTP exceptions (e.g. NotFoundException) as-is
      if (error?.status) throw error;
      throw new UnauthorizedException(error.message || 'Unauthorized');
    }
  }
}
