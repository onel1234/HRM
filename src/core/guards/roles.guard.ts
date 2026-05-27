import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestWithUser } from '../types/http';

const ROLE_HIERARCHY: UserRole[] = [
  UserRole.EMPLOYEE,
  UserRole.MANAGER,
  UserRole.HR_MANAGER,
  UserRole.COMPANY_ADMIN,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    const userLevel = ROLE_HIERARCHY.indexOf(user.role);
    const requiredLevel = Math.min(
      ...requiredRoles.map((role) => ROLE_HIERARCHY.indexOf(role)),
    );

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
