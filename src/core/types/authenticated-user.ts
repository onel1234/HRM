import { UserRole, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  companyId: string;
  email?: string;
  role: UserRole;
  status?: UserStatus;
}
