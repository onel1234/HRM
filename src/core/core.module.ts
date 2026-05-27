import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { EventBusService } from './events/event-bus.service';
import { PrismaService } from '../database/prisma.service';

@Global()
@Module({
  providers: [PrismaService, EventBusService, AuditService],
  exports: [PrismaService, EventBusService, AuditService],
})
export class CoreModule {}
