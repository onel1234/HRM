import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  ProbationReviewOutcome,
  ProbationStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateProbationReviewDto } from './dto/create-probation-review.dto';

@Injectable()
export class ProbationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventBus: EventBusService,
  ) {}

  async createReview(
    employeeId: string,
    dto: CreateProbationReviewDto,
    companyId: string,
    actorId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true, probationStatus: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (
      dto.outcome === ProbationReviewOutcome.EXTENDED &&
      !dto.nextReviewDate
    ) {
      throw new BadRequestException(
        'nextReviewDate is required when extending probation',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const review = await tx.probationReview.create({
        data: {
          companyId,
          employeeId,
          reviewedByUserId: actorId,
          outcome: dto.outcome,
          notes: dto.notes,
          nextReviewDate: dto.nextReviewDate
            ? new Date(dto.nextReviewDate)
            : undefined,
        },
      });

      await tx.employee.update({
        where: { id: employeeId },
        data: this.employeeProbationUpdate(dto),
      });

      return review;
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employee.probationReviewed',
      entityType: 'Employee',
      entityId: employeeId,
      oldValues: { probationStatus: employee.probationStatus },
      newValues: { outcome: dto.outcome, nextReviewDate: dto.nextReviewDate },
    });
    this.eventBus.emit('employee.probationReviewed', {
      companyId,
      employeeId,
      outcome: dto.outcome,
    });

    return result;
  }

  private employeeProbationUpdate(dto: CreateProbationReviewDto) {
    switch (dto.outcome) {
      case ProbationReviewOutcome.CONFIRMED:
        return {
          probationStatus: ProbationStatus.CONFIRMED,
          status: EmployeeStatus.ACTIVE,
          confirmedAt: new Date(),
        };
      case ProbationReviewOutcome.EXTENDED:
        return {
          probationStatus: ProbationStatus.EXTENDED,
          status: EmployeeStatus.ON_PROBATION,
          probationEndDate: new Date(dto.nextReviewDate || ''),
        };
      case ProbationReviewOutcome.FAILED:
        return {
          probationStatus: ProbationStatus.FAILED,
          status: EmployeeStatus.INACTIVE,
        };
      case ProbationReviewOutcome.NEEDS_REVIEW:
        return {
          probationStatus: ProbationStatus.IN_PROGRESS,
        };
    }
  }
}
