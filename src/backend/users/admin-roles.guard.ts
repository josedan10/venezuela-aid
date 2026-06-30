import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from './role.enum';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user?.roles?.split(',').includes(Role.ADMIN)) {
      throw new ForbiddenException('Acceso restringido a administradores.');
    }
    return true;
  }
}
