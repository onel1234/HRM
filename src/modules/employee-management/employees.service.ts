/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as bcrypt from 'bcryptjs';
import {
  EmployeeStatus,
  ProbationStatus,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationJob } from '../../queue/processors/notification.processor';
import { QUEUES } from '../../queue/queue.constants';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { employeeDetailSelect, employeeSummarySelect } from './employee.select';
import {
  isSriLankanNic,
  normalizeNic,
  normalizePassport,
} from './identity.util';

interface EmployeeFilters {
  page?: number;
  limit?: number;
  departmentId?: string;
  status?: EmployeeStatus;
  employmentType?: string;
  managerId?: string;
  probationStatus?: ProbationStatus;
  search?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
    private eventBus: EventBusService,
    @InjectQueue(QUEUES.NOTIFICATIONS)
    private notifications: Queue<NotificationJob>,
  ) {}

  async create(dto: CreateEmployeeDto, companyId: string, actorId: string) {
    if (dto.userId && dto.portalUser) {
      throw new BadRequestException(
        'Provide either userId or portalUser, not both',
      );
    }

    const nicNumber = normalizeNic(dto.nicNumber);
    const passportNumber = normalizePassport(dto.passportNumber);
    this.assertValidNic(nicNumber);
    await this.assertDepartment(companyId, dto.departmentId);
    await this.assertEmployee(companyId, dto.reportingManagerId, 'Manager');
    await this.assertUserLinkAvailable(companyId, dto.userId);

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        let userId = dto.userId;
        if (dto.portalUser) {
          const rounds = this.config.get<number>('app.bcryptRounds') || 12;
          const passwordHash = await bcrypt.hash(
            dto.portalUser.password,
            rounds,
          );
          const user = await tx.user.create({
            data: {
              companyId,
              email: dto.portalUser.email,
              passwordHash,
              firstName: dto.firstName,
              lastName: dto.lastName,
              role: dto.portalUser.role || UserRole.EMPLOYEE,
              phone: dto.phone,
              status: 'ACTIVE',
            },
            select: { id: true },
          });
          userId = user.id;
        }

        return tx.employee.create({
          data: {
            companyId,
            userId,
            departmentId: dto.departmentId,
            reportingManagerId: dto.reportingManagerId,
            employeeNo: dto.employeeNo,
            firstName: dto.firstName,
            lastName: dto.lastName,
            preferredName: dto.preferredName,
            workEmail: dto.workEmail,
            personalEmail: dto.personalEmail,
            phone: dto.phone,
            address: dto.address,
            nicNumber,
            passportNumber,
            dateOfBirth: this.toDate(dto.dateOfBirth),
            jobTitle: dto.jobTitle,
            employmentType: dto.employmentType,
            joinedAt: new Date(dto.joinedAt),
            probationStartDate: this.toDate(dto.probationStartDate),
            probationEndDate: this.toDate(dto.probationEndDate),
            probationStatus: dto.probationEndDate
              ? ProbationStatus.IN_PROGRESS
              : ProbationStatus.NOT_APPLICABLE,
            status: dto.probationEndDate
              ? EmployeeStatus.ON_PROBATION
              : EmployeeStatus.ACTIVE,
          },
          select: employeeDetailSelect,
        });
      });

      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'employee.created',
        entityType: 'Employee',
        entityId: employee.id,
        newValues: {
          employeeNo: employee.employeeNo,
          departmentId: dto.departmentId,
          employmentType: employee.employmentType,
        },
      });
      this.eventBus.emit('employee.joined', {
        companyId,
        employeeId: employee.id,
        departmentId: employee.department?.id || '',
        role: employee.jobTitle || '',
        joinDate: employee.joinedAt,
      });
      await this.enqueueProbationAlert(employee.id, companyId);

      return employee;
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async findAll(companyId: string, filters: EmployeeFilters) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where = {
      companyId,
      deletedAt: null,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.employmentType
        ? { employmentType: filters.employmentType as never }
        : {}),
      ...(filters.managerId ? { reportingManagerId: filters.managerId } : {}),
      ...(filters.probationStatus
        ? { probationStatus: filters.probationStatus }
        : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              {
                employeeNo: { contains: search, mode: 'insensitive' as const },
              },
              { workEmail: { contains: search, mode: 'insensitive' as const } },
              {
                nicNumber: {
                  contains: normalizeNic(search),
                  mode: 'insensitive' as const,
                },
              },
              {
                passportNumber: {
                  contains: normalizePassport(search),
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        select: employeeSummarySelect,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      select: employeeDetailSelect,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    companyId: string,
    actorId: string,
  ) {
    const current = await this.findOne(id, companyId);
    const nicNumber = normalizeNic(dto.nicNumber);
    const passportNumber = normalizePassport(dto.passportNumber);
    this.assertValidNic(nicNumber);
    await this.assertDepartment(companyId, dto.departmentId);
    await this.assertReportingManager(companyId, id, dto.reportingManagerId);
    await this.assertUserLinkAvailable(companyId, dto.userId, id);

    try {
      const employee = await this.prisma.employee.update({
        where: { id },
        data: {
          userId: dto.userId,
          departmentId: dto.departmentId,
          reportingManagerId: dto.reportingManagerId,
          employeeNo: dto.employeeNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          preferredName: dto.preferredName,
          workEmail: dto.workEmail,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          address: dto.address,
          nicNumber,
          passportNumber,
          dateOfBirth: this.toDate(dto.dateOfBirth),
          jobTitle: dto.jobTitle,
          employmentType: dto.employmentType,
          joinedAt: this.toDate(dto.joinedAt),
          probationStartDate: this.toDate(dto.probationStartDate),
          probationEndDate: this.toDate(dto.probationEndDate),
        },
        select: employeeDetailSelect,
      });

      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'employee.updated',
        entityType: 'Employee',
        entityId: id,
        oldValues: {
          departmentId: current.department?.id,
          reportingManagerId: current.reportingManager?.id,
          status: current.status,
        },
        newValues: {
          departmentId: employee.department?.id,
          reportingManagerId: employee.reportingManager?.id,
          status: employee.status,
        },
      });
      this.eventBus.emit('employee.updated', { companyId, employeeId: id });
      await this.enqueueProbationAlert(id, companyId);

      return employee;
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async remove(id: string, companyId: string, actorId: string) {
    await this.findOne(id, companyId);
    const employee = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.INACTIVE, deletedAt: new Date() },
      select: employeeDetailSelect,
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employee.deactivated',
      entityType: 'Employee',
      entityId: id,
    });
    this.eventBus.emit('employee.deactivated', { companyId, employeeId: id });
    return employee;
  }

  private async assertDepartment(companyId: string, departmentId?: string) {
    if (!departmentId) return;
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!department) throw new BadRequestException('Department is invalid');
  }

  private async assertEmployee(
    companyId: string,
    employeeId?: string,
    label = 'Employee',
  ) {
    if (!employeeId) return;
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException(`${label} is invalid`);
  }

  private async assertReportingManager(
    companyId: string,
    employeeId: string,
    reportingManagerId?: string,
  ) {
    if (!reportingManagerId) return;
    if (employeeId === reportingManagerId) {
      throw new BadRequestException('Employee cannot report to themselves');
    }

    let cursor: string | null | undefined = reportingManagerId;
    while (cursor) {
      const manager = await this.prisma.employee.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { id: true, reportingManagerId: true },
      });
      if (!manager) throw new BadRequestException('Manager is invalid');
      if (manager.reportingManagerId === employeeId) {
        throw new BadRequestException(
          'Reporting hierarchy cannot contain loops',
        );
      }
      cursor = manager.reportingManagerId;
    }
  }

  private async assertUserLinkAvailable(
    companyId: string,
    userId?: string,
    employeeId?: string,
  ) {
    if (!userId) return;
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('User is invalid');

    const existing = await this.prisma.employee.findFirst({
      where: {
        userId,
        companyId,
        ...(employeeId ? { id: { not: employeeId } } : {}),
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('User is already linked to an employee');
  }

  private assertValidNic(nicNumber?: string) {
    if (nicNumber && !isSriLankanNic(nicNumber)) {
      throw new BadRequestException(
        'NIC number must be a valid Sri Lankan NIC',
      );
    }
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private async enqueueProbationAlert(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        probationStatus: {
          in: [ProbationStatus.IN_PROGRESS, ProbationStatus.EXTENDED],
        },
        probationEndDate: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        probationEndDate: true,
      },
    });
    if (!employee?.probationEndDate) return;

    const recipients = await this.prisma.user.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        role: { in: [UserRole.HR_MANAGER, UserRole.COMPANY_ADMIN] },
      },
      select: { email: true },
    });
    const alertAt = new Date(employee.probationEndDate);
    alertAt.setDate(alertAt.getDate() - 7);
    const delay = Math.max(alertAt.getTime() - Date.now(), 0);

    await Promise.all(
      recipients.map((recipient) =>
        this.notifications.add(
          'send',
          {
            type: 'email',
            to: recipient.email,
            subject: 'Probation review due',
            body: `${employee.firstName} ${employee.lastName}'s probation review is due on ${employee.probationEndDate?.toISOString().slice(0, 10)}.`,
            companyId,
          },
          { delay, removeOnComplete: true },
        ),
      ),
    );
  }

  private handleUniqueError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Employee number, NIC, passport, email, or user link already exists',
      );
    }
    throw error;
  }
}
