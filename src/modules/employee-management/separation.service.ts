import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  SeparationStatus,
  SeparationType,
  UserStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateSeparationDto } from './dto/create-separation.dto';
import { UpdateSeparationDto } from './dto/update-separation.dto';

@Injectable()
export class SeparationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventBus: EventBusService,
  ) {}

  async create(
    employeeId: string,
    dto: CreateSeparationDto,
    companyId: string,
    actorId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    const closedStatuses: EmployeeStatus[] = [
      EmployeeStatus.SEPARATED,
      EmployeeStatus.TERMINATED,
    ];
    if (closedStatuses.includes(employee.status)) {
      throw new BadRequestException('Employee is already separated');
    }

    const request = await this.prisma.separationRequest.create({
      data: {
        companyId,
        employeeId,
        requestedByUserId: actorId,
        type: dto.type,
        reason: dto.reason,
        effectiveDate: new Date(dto.effectiveDate),
        notes: dto.notes,
      },
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employee.separationRequested',
      entityType: 'SeparationRequest',
      entityId: request.id,
      newValues: {
        employeeId,
        type: dto.type,
        effectiveDate: dto.effectiveDate,
      },
    });
    this.eventBus.emit('employee.separationRequested', {
      companyId,
      employeeId,
      separationId: request.id,
      type: dto.type,
    });

    return request;
  }

  async update(
    separationId: string,
    dto: UpdateSeparationDto,
    companyId: string,
    actorId: string,
  ) {
    const current = await this.prisma.separationRequest.findFirst({
      where: { id: separationId, companyId },
      include: { employee: { select: { id: true, userId: true } } },
    });
    if (!current) throw new NotFoundException('Separation request not found');
    this.assertTransition(current.status, dto.status);

    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.separationRequest.update({
        where: { id: separationId },
        data: {
          status: dto.status,
          notes: dto.notes ?? current.notes,
          approvedByUserId:
            dto.status === SeparationStatus.APPROVED
              ? actorId
              : current.approvedByUserId,
          approvedAt:
            dto.status === SeparationStatus.APPROVED
              ? new Date()
              : current.approvedAt,
          completedAt:
            dto.status === SeparationStatus.COMPLETED
              ? new Date()
              : current.completedAt,
        },
      });

      if (dto.status === SeparationStatus.COMPLETED) {
        const terminated = current.type === SeparationType.TERMINATION;
        await tx.employee.update({
          where: { id: current.employeeId },
          data: {
            status: terminated
              ? EmployeeStatus.TERMINATED
              : EmployeeStatus.SEPARATED,
            separatedAt: terminated ? undefined : new Date(),
            terminatedAt: terminated ? new Date() : undefined,
          },
        });

        if (current.employee.userId) {
          await tx.user.update({
            where: { id: current.employee.userId },
            data: { status: UserStatus.INACTIVE, refreshTokenHash: null },
          });
        }
      }

      return request;
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employee.separationUpdated',
      entityType: 'SeparationRequest',
      entityId: separationId,
      oldValues: { status: current.status },
      newValues: { status: dto.status },
    });
    this.eventBus.emit('employee.separationUpdated', {
      companyId,
      employeeId: current.employeeId,
      separationId,
      status: dto.status,
    });
    if (dto.status === SeparationStatus.COMPLETED) {
      this.eventBus.emit('employee.separated', {
        companyId,
        employeeId: current.employeeId,
        reason: current.reason,
        separationDate: current.effectiveDate,
      });
    }

    return result;
  }

  private assertTransition(
    current: SeparationStatus,
    next: UpdateSeparationDto['status'],
  ) {
    const terminal: SeparationStatus[] = [
      SeparationStatus.REJECTED,
      SeparationStatus.CANCELLED,
      SeparationStatus.COMPLETED,
    ];
    if (terminal.includes(current)) {
      throw new BadRequestException('Separation request is already closed');
    }
    if (
      next === SeparationStatus.COMPLETED &&
      current !== SeparationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Separation must be approved before completion',
      );
    }
    if (
      current === SeparationStatus.APPROVED &&
      (
        [
          SeparationStatus.REJECTED,
          SeparationStatus.CANCELLED,
        ] as SeparationStatus[]
      ).includes(next)
    ) {
      throw new BadRequestException(
        'Approved separations can only be completed',
      );
    }
  }
}
