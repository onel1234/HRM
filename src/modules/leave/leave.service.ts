/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  HolidayCategory,
  LeaveApplicationStatus,
  LeaveDayPart,
  LeaveEncashmentStatus,
  LeaveLedgerEntryType,
  LeaveTypeCode,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import {
  ApplyLeaveDto,
  CarryForwardDto,
  CreateEncashmentDto,
  CreateLeaveApplicationDto,
  CreateLeaveTypeDto,
  DecideLeaveApplicationDto,
  UpdateLeavePolicyDto,
  UpdateLeaveTypeDto,
  UpsertHolidayDto,
} from './dto/leave.dto';

const CBSL_2026_SOURCE =
  'https://www.cbsl.gov.lk/en/about/about-the-bank/bank-holidays-2026';

const DEFAULT_LEAVE_TYPES = [
  {
    code: LeaveTypeCode.ANNUAL,
    name: 'Annual Leave',
    paid: true,
    requiresBalance: true,
    entitlementDays: 14,
    vestingMonths: 12,
    carryForwardEnabled: true,
    carryForwardCapDays: 7,
    carryForwardExpiryMonth: 3,
    carryForwardExpiryDay: 31,
    encashmentEnabled: true,
    payrollComponentCode: 'LEAVE_ENCASH',
  },
  {
    code: LeaveTypeCode.CASUAL,
    name: 'Casual Leave',
    paid: true,
    requiresBalance: true,
    entitlementDays: 7,
    vestingMonths: 0,
  },
  {
    code: LeaveTypeCode.SICK,
    name: 'Sick Leave',
    paid: true,
    requiresBalance: true,
    entitlementDays: 7,
    vestingMonths: 0,
  },
  {
    code: LeaveTypeCode.MATERNITY,
    name: 'Maternity Leave',
    paid: true,
    requiresBalance: true,
    entitlementDays: 84,
    vestingMonths: 0,
  },
  {
    code: LeaveTypeCode.PATERNITY,
    name: 'Paternity Leave',
    paid: true,
    requiresBalance: true,
    entitlementDays: 3,
    vestingMonths: 0,
  },
  {
    code: LeaveTypeCode.NO_PAY,
    name: 'No-pay Leave',
    paid: false,
    requiresBalance: false,
    entitlementDays: 0,
    vestingMonths: 0,
    payrollComponentCode: 'UNPAID_LEAVE',
  },
];

const CBSL_2026_HOLIDAYS = [
  ['2026-01-03', 'Duruthu Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-01-15', 'Tamil Thai Pongal Day', ['BANK', 'PUBLIC', 'MERCANTILE']],
  ['2026-02-01', 'Navam Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-02-04', 'Independence Day', ['BANK', 'PUBLIC', 'MERCANTILE']],
  ['2026-02-15', 'Mahasivarathri Day', ['BANK', 'PUBLIC']],
  ['2026-03-02', 'Medin Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-03-21', 'Id-Ul-Fitre (Ramazan Festival Day)', ['BANK', 'PUBLIC']],
  ['2026-04-01', 'Bak Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-04-03', 'Good Friday', ['BANK', 'PUBLIC']],
  [
    '2026-04-13',
    'Day prior to Sinhala & Tamil New Year Day',
    ['BANK', 'PUBLIC', 'MERCANTILE'],
  ],
  [
    '2026-04-14',
    'Sinhala & Tamil New Year Day',
    ['BANK', 'PUBLIC', 'MERCANTILE'],
  ],
  ['2026-05-01', 'Vesak Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-05-01', "May Day (International Workers' Day)", ['BANK', 'PUBLIC', 'MERCANTILE']],
  [
    '2026-05-02',
    'Day following Vesak Full Moon Poya Day',
    ['BANK', 'PUBLIC', 'MERCANTILE'],
  ],
  ['2026-05-28', 'Id-Ul-Allah (Hadji Festival Day)', ['BANK', 'PUBLIC']],
  ['2026-05-30', 'Adhi Poson Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-06-29', 'Poson Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-07-29', 'Esala Full Moon Poya Day', ['BANK', 'PUBLIC']],
  [
    '2026-08-26',
    "Milad-Un-Nabi (Holy Prophet's Birthday)",
    ['BANK', 'PUBLIC', 'MERCANTILE'],
  ],
  ['2026-08-27', 'Nikini Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-09-26', 'Binara Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-10-25', 'Vap Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-11-08', 'Deepawali Festival Day', ['BANK', 'PUBLIC']],
  ['2026-11-24', 'Ill Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-12-23', 'Unduwap Full Moon Poya Day', ['BANK', 'PUBLIC']],
  ['2026-12-25', 'Christmas Day', ['BANK', 'PUBLIC', 'MERCANTILE']],
] as const;

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listLeaveTypes(companyId: string, includeInactive = false) {
    await this.ensureDefaultSetup(companyId);
    return this.prisma.leaveType.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: { policies: { where: { isActive: true } } },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createLeaveType(
    companyId: string,
    actorId: string,
    dto: CreateLeaveTypeDto,
  ) {
    try {
      const type = await this.prisma.leaveType.create({
        data: {
          companyId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          paid: dto.paid ?? true,
          requiresBalance: dto.requiresBalance ?? true,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'leave.type.created',
        entityType: 'LeaveType',
        entityId: type.id,
      });
      return type;
    } catch (error) {
      this.handleUniqueError(error, 'Leave type already exists');
    }
  }

  async updateLeaveType(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateLeaveTypeDto,
  ) {
    await this.assertLeaveType(companyId, id);
    const type = await this.prisma.leaveType.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        paid: dto.paid,
        requiresBalance: dto.requiresBalance,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.type.updated',
      entityType: 'LeaveType',
      entityId: id,
    });
    return type;
  }

  async upsertPolicy(
    companyId: string,
    actorId: string,
    dto: UpdateLeavePolicyDto,
  ) {
    await this.assertLeaveType(companyId, dto.leaveTypeId);
    const existing = await this.prisma.leavePolicy.findFirst({
      where: { companyId, leaveTypeId: dto.leaveTypeId, isActive: true },
    });
    const data = {
      entitlementDays: dto.entitlementDays,
      vestingMonths: dto.vestingMonths,
      carryForwardEnabled: dto.carryForwardEnabled,
      carryForwardCapDays: dto.carryForwardCapDays,
      carryForwardExpiryMonth: dto.carryForwardExpiryMonth,
      carryForwardExpiryDay: dto.carryForwardExpiryDay,
      encashmentEnabled: dto.encashmentEnabled,
      payrollComponentCode: dto.payrollComponentCode,
      settings: dto.settings as Prisma.InputJsonValue,
      isActive: dto.isActive,
    };
    const policy = existing
      ? await this.prisma.leavePolicy.update({ where: { id: existing.id }, data })
      : await this.prisma.leavePolicy.create({
          data: {
            companyId,
            leaveTypeId: dto.leaveTypeId,
            entitlementDays: dto.entitlementDays || 0,
            vestingMonths: dto.vestingMonths || 0,
            carryForwardEnabled: dto.carryForwardEnabled ?? false,
            carryForwardCapDays: dto.carryForwardCapDays,
            carryForwardExpiryMonth: dto.carryForwardExpiryMonth,
            carryForwardExpiryDay: dto.carryForwardExpiryDay,
            encashmentEnabled: dto.encashmentEnabled ?? false,
            payrollComponentCode: dto.payrollComponentCode,
            settings: dto.settings as Prisma.InputJsonValue,
          },
        });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.policy.upserted',
      entityType: 'LeavePolicy',
      entityId: policy.id,
    });
    return policy;
  }

  async applySelf(companyId: string, userId: string, dto: ApplyLeaveDto) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.createApplication(companyId, userId, {
      ...dto,
      employeeId: employee.id,
    });
  }

  async createApplication(
    companyId: string,
    actorId: string,
    dto: CreateLeaveApplicationDto,
  ) {
    await this.ensureDefaultSetup(companyId);
    const employee = await this.getEmployee(companyId, dto.employeeId);
    const leaveType = await this.resolveLeaveType(companyId, dto);
    const startDate = this.toDateOnly(dto.startDate);
    const endDate = this.toDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('Leave end date cannot be before start date');
    }
    const requestedDays = await this.calculateLeaveDays(
      companyId,
      startDate,
      endDate,
      dto.dayPart || LeaveDayPart.FULL_DAY,
    );
    if (requestedDays <= 0) {
      throw new BadRequestException('Leave request has no working days');
    }
    await this.assertNoOverlappingLeave(companyId, employee.id, startDate, endDate);

    if (leaveType.requiresBalance) {
      const balance = await this.ensureBalance(
        companyId,
        employee,
        leaveType.id,
        startDate.getUTCFullYear(),
        startDate,
      );
      if (this.decimalToNumber(balance.available) < requestedDays) {
        throw new BadRequestException('Insufficient leave balance');
      }
    }

    const application = await this.prisma.leaveApplication.create({
      data: {
        companyId,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        requestedByUserId: actorId,
        startDate,
        endDate,
        dayPart: dto.dayPart || LeaveDayPart.FULL_DAY,
        requestedDays,
        reason: dto.reason,
      },
      include: { employee: true, leaveType: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.application.created',
      entityType: 'LeaveApplication',
      entityId: application.id,
    });
    return application;
  }

  async listMyApplications(companyId: string, userId: string) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.listApplications(companyId, { employeeId: employee.id });
  }

  async listApplications(
    companyId: string,
    filters: {
      employeeId?: string;
      status?: LeaveApplicationStatus;
      from?: string;
      to?: string;
    },
  ) {
    await this.ensureDefaultSetup(companyId);
    return this.prisma.leaveApplication.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...this.applicationDateRange(filters.from, filters.to),
      },
      include: { employee: true, leaveType: true, approvalSteps: true },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  async cancelOwnApplication(companyId: string, userId: string, id: string) {
    const employee = await this.employeeForUser(companyId, userId);
    const application = await this.prisma.leaveApplication.findFirst({
      where: { companyId, id, employeeId: employee.id },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== LeaveApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending applications can be cancelled');
    }
    const cancelled = await this.prisma.leaveApplication.update({
      where: { id },
      data: { status: LeaveApplicationStatus.CANCELLED, cancelledAt: new Date() },
    });
    await this.audit.log({
      companyId,
      userId,
      action: 'leave.application.cancelled',
      entityType: 'LeaveApplication',
      entityId: id,
    });
    return cancelled;
  }

  async approveApplication(
    companyId: string,
    actorId: string,
    id: string,
    dto: DecideLeaveApplicationDto,
  ) {
    const application = await this.getPendingApplication(companyId, id);
    const employee = await this.getEmployee(companyId, application.employeeId);
    const leaveType = application.leaveType;
    if (leaveType.requiresBalance) {
      const balance = await this.ensureBalance(
        companyId,
        employee,
        leaveType.id,
        application.startDate.getUTCFullYear(),
        application.startDate,
      );
      const days = this.decimalToNumber(application.requestedDays);
      if (this.decimalToNumber(balance.available) < days) {
        throw new BadRequestException('Insufficient leave balance');
      }
      await this.createLedgerEntry({
        companyId,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        balanceId: balance.id,
        applicationId: application.id,
        type: LeaveLedgerEntryType.APPLICATION_APPROVED,
        quantity: -days,
        periodYear: application.startDate.getUTCFullYear(),
        effectiveDate: application.startDate,
        description: `Approved ${leaveType.name}`,
      });
    }
    const approved = await this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveApplicationStatus.APPROVED,
        approvedByUserId: actorId,
        approvedAt: new Date(),
        managerNotes: dto.notes,
      },
      include: { employee: true, leaveType: true },
    });
    await this.prisma.leaveApprovalStep.create({
      data: {
        companyId,
        leaveApplicationId: id,
        actorUserId: actorId,
        status: LeaveApplicationStatus.APPROVED,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.application.approved',
      entityType: 'LeaveApplication',
      entityId: id,
    });
    return approved;
  }

  async rejectApplication(
    companyId: string,
    actorId: string,
    id: string,
    dto: DecideLeaveApplicationDto,
  ) {
    await this.getPendingApplication(companyId, id);
    const rejected = await this.prisma.leaveApplication.update({
      where: { id },
      data: {
        status: LeaveApplicationStatus.REJECTED,
        approvedByUserId: actorId,
        rejectedAt: new Date(),
        managerNotes: dto.notes,
      },
    });
    await this.prisma.leaveApprovalStep.create({
      data: {
        companyId,
        leaveApplicationId: id,
        actorUserId: actorId,
        status: LeaveApplicationStatus.REJECTED,
        notes: dto.notes,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.application.rejected',
      entityType: 'LeaveApplication',
      entityId: id,
    });
    return rejected;
  }

  async listMyBalances(companyId: string, userId: string, year?: number) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.listBalances(companyId, employee.id, year);
  }

  async listBalances(companyId: string, employeeId: string, year?: number) {
    await this.ensureDefaultSetup(companyId);
    const employee = await this.getEmployee(companyId, employeeId);
    const periodYear = year || new Date().getUTCFullYear();
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { companyId, isActive: true, deletedAt: null },
    });
    await Promise.all(
      leaveTypes.map((type) =>
        this.ensureBalance(companyId, employee, type.id, periodYear, new Date()),
      ),
    );
    return this.prisma.leaveBalance.findMany({
      where: { companyId, employeeId, periodYear },
      include: { leaveType: true, ledgerEntries: true },
      orderBy: [{ leaveType: { name: 'asc' } }],
    });
  }

  async listHolidays(companyId: string, year?: number) {
    const selectedYear = year || new Date().getUTCFullYear();
    await this.ensureHolidayCalendar(companyId, selectedYear);
    return this.prisma.publicHoliday.findMany({
      where: { companyId, calendar: { year: selectedYear } },
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
    });
  }

  async upsertHoliday(
    companyId: string,
    actorId: string,
    year: number,
    dto: UpsertHolidayDto,
  ) {
    const calendar = await this.ensureHolidayCalendar(companyId, year);
    const holiday = await this.prisma.publicHoliday.upsert({
      where: {
        companyId_date_name: {
          companyId,
          date: this.toDateOnly(dto.date),
          name: dto.name,
        },
      },
      create: {
        companyId,
        calendarId: calendar.id,
        date: this.toDateOnly(dto.date),
        name: dto.name,
        categories: dto.categories,
        isEnabled: dto.isEnabled ?? true,
        sourceUrl: dto.sourceUrl,
      },
      update: {
        categories: dto.categories,
        isEnabled: dto.isEnabled,
        sourceUrl: dto.sourceUrl,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.holiday.upserted',
      entityType: 'PublicHoliday',
      entityId: holiday.id,
    });
    return holiday;
  }

  async teamCalendar(
    companyId: string,
    filters: { managerId?: string; from?: string; to?: string },
  ) {
    return this.prisma.leaveApplication.findMany({
      where: {
        companyId,
        status: LeaveApplicationStatus.APPROVED,
        ...(filters.managerId
          ? { employee: { reportingManagerId: filters.managerId } }
          : {}),
        ...this.applicationDateRange(filters.from, filters.to),
      },
      include: { employee: true, leaveType: true },
      orderBy: [{ startDate: 'asc' }],
    });
  }

  async carryForward(companyId: string, actorId: string, dto: CarryForwardDto) {
    await this.ensureDefaultSetup(companyId);
    const annualType = await this.resolveLeaveType(companyId, {
      leaveTypeCode: LeaveTypeCode.ANNUAL,
    });
    const policy = await this.getPolicy(companyId, annualType.id);
    if (!policy?.carryForwardEnabled) {
      throw new BadRequestException('Carry-forward is not enabled');
    }
    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        companyId,
        leaveTypeId: annualType.id,
        periodYear: dto.fromYear,
        ...(dto.employeeId ? { employeeId: dto.employeeId } : {}),
      },
    });
    const results: unknown[] = [];
    for (const source of balances) {
      const available = this.decimalToNumber(source.available);
      const cap = this.decimalToNumber(policy.carryForwardCapDays);
      const quantity = this.money(Math.min(available, cap || available));
      if (quantity <= 0) continue;
      const employee = await this.getEmployee(companyId, source.employeeId);
      const target = await this.ensureBalance(
        companyId,
        employee,
        annualType.id,
        dto.toYear,
        new Date(Date.UTC(dto.toYear, 0, 1)),
      );
      const expiresAt =
        policy.carryForwardExpiryMonth && policy.carryForwardExpiryDay
          ? new Date(
              Date.UTC(
                dto.toYear,
                policy.carryForwardExpiryMonth - 1,
                policy.carryForwardExpiryDay,
              ),
            )
          : undefined;
      results.push(
        await this.createLedgerEntry({
          companyId,
          employeeId: source.employeeId,
          leaveTypeId: annualType.id,
          balanceId: target.id,
          type: LeaveLedgerEntryType.CARRY_FORWARD,
          quantity,
          periodYear: dto.toYear,
          effectiveDate: new Date(Date.UTC(dto.toYear, 0, 1)),
          expiresAt,
          description: `Carry-forward from ${dto.fromYear}`,
        }),
      );
    }
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.carry_forward.created',
      entityType: 'LeaveLedgerEntry',
      metadata: { fromYear: dto.fromYear, toYear: dto.toYear } as Prisma.InputJsonValue,
    });
    return { carriedForward: results.length };
  }

  async createEncashment(
    companyId: string,
    actorId: string,
    dto: CreateEncashmentDto,
  ) {
    await this.ensureDefaultSetup(companyId);
    await this.getEmployee(companyId, dto.employeeId);
    const leaveType = await this.resolveLeaveType(companyId, dto);
    const policy = await this.getPolicy(companyId, leaveType.id);
    if (!policy?.encashmentEnabled) {
      throw new BadRequestException('Encashment is not enabled for this leave type');
    }
    const encashment = await this.prisma.leaveEncashment.create({
      data: {
        companyId,
        employeeId: dto.employeeId,
        leaveTypeId: leaveType.id,
        days: dto.days,
        amount: dto.amount,
        notes: dto.notes,
      },
      include: { employee: true, leaveType: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.encashment.created',
      entityType: 'LeaveEncashment',
      entityId: encashment.id,
    });
    return encashment;
  }

  async listEncashments(companyId: string, employeeId?: string) {
    return this.prisma.leaveEncashment.findMany({
      where: { companyId, ...(employeeId ? { employeeId } : {}) },
      include: { employee: true, leaveType: true },
      orderBy: [{ requestedAt: 'desc' }],
    });
  }

  async approveEncashment(companyId: string, actorId: string, id: string) {
    const current = await this.prisma.leaveEncashment.findFirst({
      where: { companyId, id },
      include: { leaveType: true, employee: { include: { salaryProfile: true } } },
    });
    if (!current) throw new NotFoundException('Leave encashment not found');
    if (current.status !== LeaveEncashmentStatus.PENDING) {
      throw new BadRequestException('Only pending encashments can be approved');
    }
    const employee = await this.getEmployee(companyId, current.employeeId);
    const balance = await this.ensureBalance(
      companyId,
      employee,
      current.leaveTypeId,
      new Date().getUTCFullYear(),
      new Date(),
    );
    const days = this.decimalToNumber(current.days);
    if (this.decimalToNumber(balance.available) < days) {
      throw new BadRequestException('Insufficient leave balance');
    }
    const amount =
      this.decimalToNumber(current.amount) ||
      this.money(
        (this.decimalToNumber(current.employee.salaryProfile?.basicSalary) / 30) *
          days,
      );
    await this.createLedgerEntry({
      companyId,
      employeeId: current.employeeId,
      leaveTypeId: current.leaveTypeId,
      balanceId: balance.id,
      encashmentId: current.id,
      type: LeaveLedgerEntryType.ENCASHMENT,
      quantity: -days,
      periodYear: new Date().getUTCFullYear(),
      effectiveDate: new Date(),
      description: 'Leave encashment approved',
    });
    const approved = await this.prisma.leaveEncashment.update({
      where: { id },
      data: {
        status: LeaveEncashmentStatus.APPROVED,
        approvedByUserId: actorId,
        approvedAt: new Date(),
        amount,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.encashment.approved',
      entityType: 'LeaveEncashment',
      entityId: id,
    });
    return approved;
  }

  async rejectEncashment(companyId: string, actorId: string, id: string) {
    const current = await this.prisma.leaveEncashment.findFirst({
      where: { companyId, id },
    });
    if (!current) throw new NotFoundException('Leave encashment not found');
    if (current.status !== LeaveEncashmentStatus.PENDING) {
      throw new BadRequestException('Only pending encashments can be rejected');
    }
    const rejected = await this.prisma.leaveEncashment.update({
      where: { id },
      data: {
        status: LeaveEncashmentStatus.REJECTED,
        approvedByUserId: actorId,
        rejectedAt: new Date(),
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'leave.encashment.rejected',
      entityType: 'LeaveEncashment',
      entityId: id,
    });
    return rejected;
  }

  async calculateLeaveDays(
    companyId: string,
    startDate: Date,
    endDate: Date,
    dayPart: LeaveDayPart = LeaveDayPart.FULL_DAY,
  ) {
    const holidays = await this.prisma.publicHoliday.findMany({
      where: {
        companyId,
        isEnabled: true,
        date: { gte: startDate, lte: endDate },
        OR: [
          { categories: { has: HolidayCategory.PUBLIC } },
          { categories: { has: HolidayCategory.MERCANTILE } },
        ],
      },
      select: { date: true },
    });
    const holidayKeys = new Set(holidays.map((holiday) => this.dateKey(holiday.date)));
    let days = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const day = cursor.getUTCDay();
      if (day !== 0 && day !== 6 && !holidayKeys.has(this.dateKey(cursor))) {
        days += 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (dayPart !== LeaveDayPart.FULL_DAY && this.dateKey(startDate) === this.dateKey(endDate)) {
      days = days > 0 ? 0.5 : 0;
    }
    return this.money(days);
  }

  private async ensureDefaultSetup(companyId: string) {
    for (const item of DEFAULT_LEAVE_TYPES) {
      const leaveType = await this.prisma.leaveType.upsert({
        where: { companyId_code: { companyId, code: item.code } },
        create: {
          companyId,
          code: item.code,
          name: item.name,
          paid: item.paid,
          requiresBalance: item.requiresBalance,
          isSystem: true,
        },
        update: {},
      });
      const policy = await this.prisma.leavePolicy.findFirst({
        where: { companyId, leaveTypeId: leaveType.id, isActive: true },
      });
      if (!policy) {
        await this.prisma.leavePolicy.create({
          data: {
            companyId,
            leaveTypeId: leaveType.id,
            entitlementDays: item.entitlementDays,
            vestingMonths: item.vestingMonths,
            carryForwardEnabled: item.carryForwardEnabled ?? false,
            carryForwardCapDays: item.carryForwardCapDays,
            carryForwardExpiryMonth: item.carryForwardExpiryMonth,
            carryForwardExpiryDay: item.carryForwardExpiryDay,
            encashmentEnabled: item.encashmentEnabled ?? false,
            payrollComponentCode: item.payrollComponentCode,
          },
        });
      }
    }
    await this.ensureHolidayCalendar(companyId, 2026);
  }

  private async ensureHolidayCalendar(companyId: string, year: number) {
    let calendar = await this.prisma.holidayCalendar.findUnique({
      where: { companyId_year: { companyId, year } },
    });
    if (!calendar) {
      calendar = await this.prisma.holidayCalendar.create({
        data: {
          companyId,
          year,
          name: `Sri Lanka Holidays ${year}`,
          sourceUrl: year === 2026 ? CBSL_2026_SOURCE : undefined,
        },
      });
    }
    if (year === 2026) {
      for (const [date, name, categories] of CBSL_2026_HOLIDAYS) {
        const categoryValues = [...categories] as unknown as HolidayCategory[];
        await this.prisma.publicHoliday.upsert({
          where: {
            companyId_date_name: {
              companyId,
              date: this.toDateOnly(date),
              name,
            },
          },
          create: {
            companyId,
            calendarId: calendar.id,
            date: this.toDateOnly(date),
            name,
            categories: categoryValues,
            isEnabled:
              categoryValues.includes(HolidayCategory.PUBLIC) ||
              categoryValues.includes(HolidayCategory.MERCANTILE),
            sourceUrl: CBSL_2026_SOURCE,
          },
          update: {},
        });
      }
    }
    return calendar;
  }

  private async ensureBalance(
    companyId: string,
    employee: { id: string; joinedAt: Date },
    leaveTypeId: string,
    periodYear: number,
    asOf: Date,
  ) {
    const policy = await this.getPolicy(companyId, leaveTypeId);
    const balance = await this.prisma.leaveBalance.upsert({
      where: {
        companyId_employeeId_leaveTypeId_periodYear: {
          companyId,
          employeeId: employee.id,
          leaveTypeId,
          periodYear,
        },
      },
      create: {
        companyId,
        employeeId: employee.id,
        leaveTypeId,
        periodYear,
      },
      update: {},
    });
    if (!policy) return balance;
    const vestedAt = new Date(employee.joinedAt);
    vestedAt.setUTCMonth(vestedAt.getUTCMonth() + policy.vestingMonths);
    const entitled = asOf >= vestedAt ? this.decimalToNumber(policy.entitlementDays) : 0;
    const accrued = this.decimalToNumber(balance.accrued);
    if (entitled > accrued) {
      await this.createLedgerEntry({
        companyId,
        employeeId: employee.id,
        leaveTypeId,
        balanceId: balance.id,
        type: LeaveLedgerEntryType.ACCRUAL,
        quantity: this.money(entitled - accrued),
        periodYear,
        effectiveDate: asOf,
        description: 'Annual leave entitlement accrued',
      });
      return this.prisma.leaveBalance.findUniqueOrThrow({ where: { id: balance.id } });
    }
    return balance;
  }

  private async createLedgerEntry(input: {
    companyId: string;
    employeeId: string;
    leaveTypeId: string;
    balanceId?: string;
    applicationId?: string;
    encashmentId?: string;
    type: LeaveLedgerEntryType;
    quantity: number;
    periodYear: number;
    effectiveDate: Date;
    expiresAt?: Date;
    description?: string;
  }) {
    const entry = await this.prisma.leaveLedgerEntry.create({
      data: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        leaveBalanceId: input.balanceId,
        leaveApplicationId: input.applicationId,
        leaveEncashmentId: input.encashmentId,
        type: input.type,
        quantity: input.quantity,
        periodYear: input.periodYear,
        effectiveDate: input.effectiveDate,
        expiresAt: input.expiresAt,
        description: input.description,
      },
    });
    if (input.balanceId) {
      await this.applyLedgerToBalance(input.balanceId, input.type, input.quantity);
    }
    return entry;
  }

  private async applyLedgerToBalance(
    balanceId: string,
    type: LeaveLedgerEntryType,
    quantity: number,
  ) {
    const positive = Math.abs(quantity);
    const data: Prisma.LeaveBalanceUpdateInput = {};
    if (type === LeaveLedgerEntryType.ACCRUAL) data.accrued = { increment: positive };
    if (type === LeaveLedgerEntryType.CARRY_FORWARD) data.carriedForward = { increment: positive };
    if (type === LeaveLedgerEntryType.APPLICATION_APPROVED) data.used = { increment: positive };
    if (type === LeaveLedgerEntryType.APPLICATION_REVERSED) data.used = { decrement: positive };
    if (type === LeaveLedgerEntryType.ENCASHMENT) data.encashed = { increment: positive };
    if (type === LeaveLedgerEntryType.EXPIRY) data.expired = { increment: positive };
    if (type === LeaveLedgerEntryType.MANUAL_ADJUSTMENT) data.adjusted = { increment: quantity };
    data.available = { increment: quantity };
    await this.prisma.leaveBalance.update({ where: { id: balanceId }, data });
  }

  private async getPendingApplication(companyId: string, id: string) {
    const application = await this.prisma.leaveApplication.findFirst({
      where: { companyId, id },
      include: { leaveType: true },
    });
    if (!application) throw new NotFoundException('Leave application not found');
    if (application.status !== LeaveApplicationStatus.PENDING) {
      throw new BadRequestException('Only pending leave applications can be decided');
    }
    return application;
  }

  private async resolveLeaveType(
    companyId: string,
    dto: { leaveTypeId?: string; leaveTypeCode?: LeaveTypeCode },
  ) {
    const leaveType = dto.leaveTypeId
      ? await this.prisma.leaveType.findFirst({
          where: { companyId, id: dto.leaveTypeId, deletedAt: null },
        })
      : await this.prisma.leaveType.findFirst({
          where: {
            companyId,
            code: dto.leaveTypeCode || LeaveTypeCode.ANNUAL,
            deletedAt: null,
          },
        });
    if (!leaveType) throw new BadRequestException('Leave type is invalid');
    return leaveType;
  }

  private async getPolicy(companyId: string, leaveTypeId: string) {
    return this.prisma.leavePolicy.findFirst({
      where: { companyId, leaveTypeId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async getEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, id: employeeId, deletedAt: null },
      select: { id: true, joinedAt: true },
    });
    if (!employee) throw new BadRequestException('Employee is invalid');
    return employee;
  }

  private async employeeForUser(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true, joinedAt: true },
    });
    if (!employee) throw new BadRequestException('User is not linked to an employee');
    return employee;
  }

  private async assertLeaveType(companyId: string, id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { companyId, id, deletedAt: null },
      select: { id: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');
  }

  private async assertNoOverlappingLeave(
    companyId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const existing = await this.prisma.leaveApplication.findFirst({
      where: {
        companyId,
        employeeId,
        status: { in: [LeaveApplicationStatus.PENDING, LeaveApplicationStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Leave request overlaps existing leave');
  }

  private applicationDateRange(from?: string, to?: string) {
    if (!from && !to) return {};
    return {
      startDate: { ...(to ? { lte: this.toDateOnly(to) } : {}) },
      endDate: { ...(from ? { gte: this.toDateOnly(from) } : {}) },
    };
  }

  private toDateOnly(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Date is invalid');
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private decimalToNumber(value: unknown) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value);
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
