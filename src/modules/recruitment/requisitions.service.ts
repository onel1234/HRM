import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequisitionStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';

@Injectable()
export class RequisitionsService {
  private readonly logger = new Logger(RequisitionsService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateRequisitionDto, companyId: string, userId: string) {
    const requisition = await this.prisma.jobRequisition.create({
      data: {
        companyId,
        departmentId: dto.departmentId,
        hiringManagerId: dto.hiringManagerId,
        jobTitle: dto.jobTitle,
        description: dto.description,
        requirements: dto.requirements ?? undefined,
        employmentType: dto.employmentType,
        headcount: dto.headcount,
        priority: dto.priority,
        status: RequisitionStatus.PENDING_APPROVAL,
        salaryRangeMin: dto.salaryRangeMin,
        salaryRangeMax: dto.salaryRangeMax,
        justification: dto.justification,
        desiredStartDate: dto.desiredStartDate
          ? new Date(dto.desiredStartDate)
          : undefined,
      },
      include: { department: true, hiringManager: true },
    });

    this.events.emit('requisition.created', {
      companyId,
      requisitionId: requisition.id,
    });
    void this.audit.log({
      companyId,
      userId,
      action: 'requisition.created',
      entityType: 'JobRequisition',
      entityId: requisition.id,
      newValues: dto as any,
    });

    return requisition;
  }

  async findAll(
    companyId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: RequisitionStatus;
      departmentId?: string;
      priority?: string;
      search?: string;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.jobRequisition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { department: true, hiringManager: true },
      }),
      this.prisma.jobRequisition.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, companyId: string) {
    const requisition = await this.prisma.jobRequisition.findFirst({
      where: { id, companyId },
      include: {
        department: true,
        hiringManager: true,
        approvals: { include: { approver: true }, orderBy: { actedAt: 'desc' } },
        jobPostings: true,
      },
    });
    if (!requisition) throw new NotFoundException('Requisition not found');
    return requisition;
  }

  async approve(
    id: string,
    dto: ApproveRequisitionDto,
    companyId: string,
    userId: string,
  ) {
    const requisition = await this.prisma.jobRequisition.findFirst({
      where: { id, companyId },
    });
    if (!requisition) throw new NotFoundException('Requisition not found');
    if (requisition.status !== RequisitionStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Requisition is not pending approval',
      );
    }

    const isApproved = dto.status === RequisitionStatus.APPROVED;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.requisitionApproval.create({
        data: {
          companyId,
          requisitionId: id,
          approverUserId: userId,
          status: dto.status,
          notes: dto.notes,
        },
      });

      return tx.jobRequisition.update({
        where: { id },
        data: {
          status: isApproved ? RequisitionStatus.OPEN : RequisitionStatus.REJECTED,
          approvedAt: isApproved ? new Date() : undefined,
          rejectedAt: !isApproved ? new Date() : undefined,
        },
        include: { department: true, hiringManager: true },
      });
    });

    this.events.emit(
      isApproved ? 'requisition.approved' : 'requisition.rejected',
      { companyId, requisitionId: id },
    );
    void this.audit.log({
      companyId,
      userId,
      action: isApproved ? 'requisition.approved' : 'requisition.rejected',
      entityType: 'JobRequisition',
      entityId: id,
      newValues: dto as any,
    });

    return updated;
  }

  async update(
    id: string,
    dto: Partial<CreateRequisitionDto>,
    companyId: string,
    userId: string,
  ) {
    const requisition = await this.prisma.jobRequisition.findFirst({
      where: { id, companyId },
    });
    if (!requisition) throw new NotFoundException('Requisition not found');
    if (
      requisition.status !== RequisitionStatus.DRAFT &&
      requisition.status !== RequisitionStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException('Cannot update requisition in current status');
    }

    const updated = await this.prisma.jobRequisition.update({
      where: { id },
      data: {
        ...dto,
        requirements: dto.requirements ?? undefined,
        desiredStartDate: dto.desiredStartDate
          ? new Date(dto.desiredStartDate)
          : undefined,
      },
      include: { department: true, hiringManager: true },
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'requisition.updated',
      entityType: 'JobRequisition',
      entityId: id,
      newValues: dto as any,
    });

    return updated;
  }

  async cancel(id: string, companyId: string, userId: string) {
    const requisition = await this.prisma.jobRequisition.findFirst({
      where: { id, companyId },
    });
    if (!requisition) throw new NotFoundException('Requisition not found');

    const updated = await this.prisma.jobRequisition.update({
      where: { id },
      data: {
        status: RequisitionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    this.events.emit('requisition.cancelled', {
      companyId,
      requisitionId: id,
    });
    void this.audit.log({
      companyId,
      userId,
      action: 'requisition.cancelled',
      entityType: 'JobRequisition',
      entityId: id,
    });

    return updated;
  }
}
