import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface AuditLogInput {
  companyId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(input: AuditLogInput): Promise<void> {
    return this.prisma.auditLog
      .create({ data: input })
      .then(() => undefined)
      .catch(() => undefined);
  }
}
