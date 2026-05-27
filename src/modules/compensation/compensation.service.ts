import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BenefitEnrollmentStatus,
  CompensationItemStatus,
  CompensationPlanStatus,
  Prisma,
  VariablePayStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import {
  AddIncrementPlanEmployeesDto,
  AssignCompensationBandDto,
  CreateAnnualIncrementPlanDto,
  CreateBenefitPlanDto,
  CreateCompensationBandDto,
  CreateCompensationGradeDto,
  CreateVariablePayAwardDto,
  EnrollBenefitDto,
  UpsertAllowanceRecordDto,
  UpsertIncrementPlanItemDto,
  UpdateAnnualIncrementPlanDto,
  UpdateBenefitPlanDto,
  UpdateCompensationBandDto,
  UpdateCompensationGradeDto,
  UpdateVariablePayAwardDto,
} from './dto/compensation.dto';
import { CompensationPdfService } from './compensation-pdf.service';

@Injectable()
export class CompensationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private pdf: CompensationPdfService,
  ) {}

  async createGrade(
    companyId: string,
    actorId: string,
    dto: CreateCompensationGradeDto,
  ) {
    try {
      const grade = await this.prisma.compensationGrade.create({
        data: {
          companyId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          description: dto.description,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'compensation.grade.created',
        entityType: 'CompensationGrade',
        entityId: grade.id,
      });
      return grade;
    } catch (error) {
      this.handleUniqueError(error, 'Compensation grade already exists');
    }
  }

  listGrades(companyId: string) {
    return this.prisma.compensationGrade.findMany({
      where: { companyId },
      include: { bands: { orderBy: [{ minSalary: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async updateGrade(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateCompensationGradeDto,
  ) {
    await this.assertGrade(companyId, id);
    const grade = await this.prisma.compensationGrade.update({
      where: { id },
      data: {
        code: dto.code?.toUpperCase(),
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.grade.updated',
      entityType: 'CompensationGrade',
      entityId: id,
    });
    return grade;
  }

  async createBand(
    companyId: string,
    actorId: string,
    dto: CreateCompensationBandDto,
  ) {
    await this.assertGrade(companyId, dto.gradeId);
    this.assertSalaryRange(dto.minSalary, dto.maxSalary, dto.midpoint);
    try {
      const band = await this.prisma.compensationBand.create({
        data: {
          companyId,
          gradeId: dto.gradeId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          minSalary: dto.minSalary,
          midpoint: dto.midpoint,
          maxSalary: dto.maxSalary,
          currency: dto.currency ?? 'LKR',
          description: dto.description,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'compensation.band.created',
        entityType: 'CompensationBand',
        entityId: band.id,
      });
      return band;
    } catch (error) {
      this.handleUniqueError(error, 'Compensation band already exists');
    }
  }

  listBands(companyId: string, gradeId?: string) {
    return this.prisma.compensationBand.findMany({
      where: { companyId, ...(gradeId ? { gradeId } : {}) },
      include: { grade: true },
      orderBy: [{ grade: { sortOrder: 'asc' } }, { minSalary: 'asc' }],
    });
  }

  async updateBand(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateCompensationBandDto,
  ) {
    const current = await this.assertBand(companyId, id);
    const gradeId = dto.gradeId ?? current.gradeId;
    await this.assertGrade(companyId, gradeId);
    this.assertSalaryRange(
      dto.minSalary ?? this.decimalToNumber(current.minSalary),
      dto.maxSalary ?? this.decimalToNumber(current.maxSalary),
      dto.midpoint ?? this.decimalToNumber(current.midpoint),
    );
    const band = await this.prisma.compensationBand.update({
      where: { id },
      data: {
        gradeId: dto.gradeId,
        code: dto.code?.toUpperCase(),
        name: dto.name,
        minSalary: dto.minSalary,
        midpoint: dto.midpoint,
        maxSalary: dto.maxSalary,
        currency: dto.currency,
        description: dto.description,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.band.updated',
      entityType: 'CompensationBand',
      entityId: id,
    });
    return band;
  }

  async assignEmployeeBand(
    companyId: string,
    actorId: string,
    employeeId: string,
    dto: AssignCompensationBandDto,
  ) {
    await this.assertEmployee(companyId, employeeId);
    await this.assertGrade(companyId, dto.gradeId);
    if (dto.bandId) {
      const band = await this.assertBand(companyId, dto.bandId);
      if (band.gradeId !== dto.gradeId) {
        throw new BadRequestException('Band does not belong to the grade');
      }
    }
    const profile = await this.prisma.salaryProfile.findFirst({
      where: { companyId, employeeId, isActive: true },
    });
    if (!profile) throw new NotFoundException('Salary profile not found');
    const updated = await this.prisma.salaryProfile.update({
      where: { id: profile.id },
      data: {
        compensationGradeId: dto.gradeId,
        compensationBandId: dto.bandId,
      },
      include: { compensationGrade: true, compensationBand: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.employee_band.assigned',
      entityType: 'SalaryProfile',
      entityId: profile.id,
      metadata: { employeeId, gradeId: dto.gradeId, bandId: dto.bandId },
    });
    return updated;
  }

  async createIncrementPlan(
    companyId: string,
    actorId: string,
    dto: CreateAnnualIncrementPlanDto,
  ) {
    try {
      const plan = await this.prisma.annualIncrementPlan.create({
        data: {
          companyId,
          name: dto.name,
          fiscalYear: dto.fiscalYear,
          budgetAmount: dto.budgetAmount,
          budgetPercent: dto.budgetPercent,
          plannedEffectiveDate: this.toDate(dto.plannedEffectiveDate),
          notes: dto.notes,
          createdByUserId: actorId,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'compensation.increment_plan.created',
        entityType: 'AnnualIncrementPlan',
        entityId: plan.id,
      });
      return plan;
    } catch (error) {
      this.handleUniqueError(error, 'Increment plan already exists');
    }
  }

  listIncrementPlans(companyId: string, fiscalYear?: number) {
    return this.prisma.annualIncrementPlan.findMany({
      where: { companyId, ...(fiscalYear ? { fiscalYear } : {}) },
      include: { items: { select: { id: true, status: true } } },
      orderBy: [{ fiscalYear: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getIncrementPlan(companyId: string, id: string) {
    const plan = await this.prisma.annualIncrementPlan.findFirst({
      where: { companyId, id },
      include: {
        items: {
          include: {
            employee: { include: { department: true } },
            salaryProfile: {
              include: { compensationGrade: true, compensationBand: true },
            },
          },
          orderBy: [{ employee: { employeeNo: 'asc' } }, { createdAt: 'asc' }],
        },
      },
    });
    if (!plan) throw new NotFoundException('Increment plan not found');
    return plan;
  }

  async updateIncrementPlan(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateAnnualIncrementPlanDto,
  ) {
    await this.assertIncrementPlan(companyId, id);
    const plan = await this.prisma.annualIncrementPlan.update({
      where: { id },
      data: {
        name: dto.name,
        fiscalYear: dto.fiscalYear,
        status: dto.status,
        budgetAmount: dto.budgetAmount,
        budgetPercent: dto.budgetPercent,
        plannedEffectiveDate: dto.plannedEffectiveDate
          ? this.toDate(dto.plannedEffectiveDate)
          : undefined,
        notes: dto.notes,
        submittedAt:
          dto.status === CompensationPlanStatus.SUBMITTED
            ? new Date()
            : undefined,
        approvedAt:
          dto.status === CompensationPlanStatus.APPROVED
            ? new Date()
            : undefined,
        approvedByUserId:
          dto.status === CompensationPlanStatus.APPROVED ? actorId : undefined,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.increment_plan.updated',
      entityType: 'AnnualIncrementPlan',
      entityId: id,
      metadata: { status: dto.status },
    });
    return plan;
  }

  async addEmployeesToIncrementPlan(
    companyId: string,
    actorId: string,
    planId: string,
    dto: AddIncrementPlanEmployeesDto,
  ) {
    const plan = await this.assertIncrementPlan(companyId, planId);
    if (plan.status === CompensationPlanStatus.APPLIED) {
      throw new BadRequestException('Applied plans cannot be changed');
    }
    const profiles = await this.prisma.salaryProfile.findMany({
      where: {
        companyId,
        isActive: true,
        employee: {
          deletedAt: null,
          ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
          ...(dto.employeeIds?.length ? { id: { in: dto.employeeIds } } : {}),
        },
      },
      include: { employee: true },
    });
    if (!profiles.length) throw new BadRequestException('No employees found');

    for (const profile of profiles) {
      const currentSalary = this.decimalToNumber(profile.basicSalary);
      const proposedAmount =
        dto.defaultAmount ??
        (dto.defaultPercent != null
          ? this.money((currentSalary * dto.defaultPercent) / 100)
          : undefined);
      await this.prisma.annualIncrementPlanItem.upsert({
        where: {
          planId_employeeId: { planId, employeeId: profile.employeeId },
        },
        create: {
          companyId,
          planId,
          employeeId: profile.employeeId,
          salaryProfileId: profile.id,
          currentSalary,
          proposedPercent: dto.defaultPercent,
          proposedAmount,
          newSalary:
            proposedAmount != null
              ? this.money(currentSalary + proposedAmount)
              : undefined,
          effectiveDate: plan.plannedEffectiveDate,
        },
        update: {},
      });
    }
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.increment_plan.employees_added',
      entityType: 'AnnualIncrementPlan',
      entityId: planId,
      metadata: { count: profiles.length },
    });
    return this.getIncrementPlan(companyId, planId);
  }

  async upsertIncrementItem(
    companyId: string,
    actorId: string,
    planId: string,
    dto: UpsertIncrementPlanItemDto,
  ) {
    const plan = await this.assertIncrementPlan(companyId, planId);
    await this.assertEmployee(companyId, dto.employeeId);
    const profile = await this.prisma.salaryProfile.findFirst({
      where: { companyId, employeeId: dto.employeeId, isActive: true },
    });
    if (!profile) throw new NotFoundException('Salary profile not found');
    const currentSalary = this.decimalToNumber(profile.basicSalary);
    const proposedAmount = this.amountFromPercent(
      currentSalary,
      dto.proposedPercent,
      dto.proposedAmount,
    );
    const approvedAmount = this.amountFromPercent(
      currentSalary,
      dto.approvedPercent,
      dto.approvedAmount,
    );
    const increase = approvedAmount ?? proposedAmount ?? 0;
    const item = await this.prisma.annualIncrementPlanItem.upsert({
      where: { planId_employeeId: { planId, employeeId: dto.employeeId } },
      create: {
        companyId,
        planId,
        employeeId: dto.employeeId,
        salaryProfileId: profile.id,
        currentSalary,
        proposedPercent: dto.proposedPercent,
        proposedAmount,
        approvedPercent: dto.approvedPercent,
        approvedAmount,
        newSalary: this.money(currentSalary + increase),
        status: dto.status ?? CompensationItemStatus.PROPOSED,
        rationale: dto.rationale,
        effectiveDate: dto.effectiveDate
          ? this.toDate(dto.effectiveDate)
          : plan.plannedEffectiveDate,
      },
      update: {
        salaryProfileId: profile.id,
        currentSalary,
        proposedPercent: dto.proposedPercent,
        proposedAmount,
        approvedPercent: dto.approvedPercent,
        approvedAmount,
        newSalary: this.money(currentSalary + increase),
        status: dto.status,
        rationale: dto.rationale,
        effectiveDate: dto.effectiveDate
          ? this.toDate(dto.effectiveDate)
          : undefined,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.increment_plan.item_upserted',
      entityType: 'AnnualIncrementPlanItem',
      entityId: item.id,
    });
    return item;
  }

  async applyIncrementPlan(companyId: string, actorId: string, planId: string) {
    const plan = await this.assertIncrementPlan(companyId, planId);
    if (plan.status !== CompensationPlanStatus.APPROVED) {
      throw new BadRequestException('Only approved plans can be applied');
    }
    const items = await this.prisma.annualIncrementPlanItem.findMany({
      where: {
        companyId,
        planId,
        status: CompensationItemStatus.APPROVED,
        salaryProfileId: { not: null },
      },
    });
    if (!items.length) {
      throw new BadRequestException('No approved increment items to apply');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const newSalary =
          this.decimalToNumber(item.newSalary) ||
          this.money(
            this.decimalToNumber(item.currentSalary) +
              this.decimalToNumber(item.approvedAmount),
          );
        await tx.salaryProfile.update({
          where: { id: item.salaryProfileId as string },
          data: {
            basicSalary: newSalary,
            effectiveFrom: item.effectiveDate ?? plan.plannedEffectiveDate,
          },
        });
        await tx.annualIncrementPlanItem.update({
          where: { id: item.id },
          data: {
            status: CompensationItemStatus.APPLIED,
            appliedAt: new Date(),
          },
        });
      }
      await tx.annualIncrementPlan.update({
        where: { id: planId },
        data: { status: CompensationPlanStatus.APPLIED, appliedAt: new Date() },
      });
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.increment_plan.applied',
      entityType: 'AnnualIncrementPlan',
      entityId: planId,
      metadata: { count: items.length },
    });
    return this.getIncrementPlan(companyId, planId);
  }

  async createVariablePayAward(
    companyId: string,
    actorId: string,
    dto: CreateVariablePayAwardDto,
  ) {
    await this.assertEmployee(companyId, dto.employeeId);
    if (dto.salaryComponentId)
      await this.assertSalaryComponent(companyId, dto.salaryComponentId);
    const award = await this.prisma.variablePayAward.create({
      data: { companyId, createdByUserId: actorId, ...dto },
      include: { employee: true, salaryComponent: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.variable_pay.created',
      entityType: 'VariablePayAward',
      entityId: award.id,
    });
    return award;
  }

  listVariablePayAwards(
    companyId: string,
    filters: { employeeId?: string; periodYear?: number; status?: string },
  ) {
    return this.prisma.variablePayAward.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
        ...(filters.status
          ? { status: filters.status as VariablePayStatus }
          : {}),
      },
      include: { employee: true, salaryComponent: true },
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async updateVariablePayAward(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateVariablePayAwardDto,
  ) {
    await this.assertVariablePayAward(companyId, id);
    if (dto.employeeId) await this.assertEmployee(companyId, dto.employeeId);
    if (dto.salaryComponentId)
      await this.assertSalaryComponent(companyId, dto.salaryComponentId);
    const award = await this.prisma.variablePayAward.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        salaryComponentId: dto.salaryComponentId,
        type: dto.type,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        amount: dto.amount,
        currency: dto.currency,
        reason: dto.reason,
        performancePeriod: dto.performancePeriod,
        status: dto.status,
        approvedByUserId:
          dto.status === VariablePayStatus.APPROVED ? actorId : undefined,
        approvedAt:
          dto.status === VariablePayStatus.APPROVED ? new Date() : undefined,
        paidAt: dto.status === VariablePayStatus.PAID ? new Date() : undefined,
      },
      include: { employee: true, salaryComponent: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.variable_pay.updated',
      entityType: 'VariablePayAward',
      entityId: id,
      metadata: { status: dto.status },
    });
    return award;
  }

  async upsertAllowanceRecord(
    companyId: string,
    actorId: string,
    dto: UpsertAllowanceRecordDto,
  ) {
    await this.assertEmployee(companyId, dto.employeeId);
    const record = await this.prisma.allowanceRecord.upsert({
      where: {
        companyId_employeeId_type_periodYear_periodMonth: {
          companyId,
          employeeId: dto.employeeId,
          type: dto.type,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
        },
      },
      create: {
        companyId,
        createdByUserId: actorId,
        employeeId: dto.employeeId,
        type: dto.type,
        status: dto.status,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        entitlement: dto.entitlement ?? 0,
        claimedAmount: dto.claimedAmount ?? 0,
        approvedAmount: dto.approvedAmount ?? 0,
        currency: dto.currency ?? 'LKR',
        notes: dto.notes,
        receiptRequired: dto.receiptRequired ?? false,
      },
      update: {
        status: dto.status,
        entitlement: dto.entitlement,
        claimedAmount: dto.claimedAmount,
        approvedAmount: dto.approvedAmount,
        currency: dto.currency,
        notes: dto.notes,
        receiptRequired: dto.receiptRequired,
      },
      include: { employee: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.allowance.upserted',
      entityType: 'AllowanceRecord',
      entityId: record.id,
    });
    return record;
  }

  listAllowanceRecords(
    companyId: string,
    filters: {
      employeeId?: string;
      periodYear?: number;
      periodMonth?: number;
      type?: string;
    },
  ) {
    return this.prisma.allowanceRecord.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
        ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
        ...(filters.type ? { type: filters.type as never } : {}),
      },
      include: { employee: true },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async createBenefitPlan(
    companyId: string,
    actorId: string,
    dto: CreateBenefitPlanDto,
  ) {
    this.assertDateWindow(dto.enrolmentWindowStart, dto.enrolmentWindowEnd);
    try {
      const plan = await this.prisma.benefitPlan.create({
        data: {
          companyId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          type: dto.type,
          description: dto.description,
          employeeContribution: dto.employeeContribution ?? 0,
          employerContribution: dto.employerContribution ?? 0,
          coverageAmount: dto.coverageAmount,
          currency: dto.currency ?? 'LKR',
          enrolmentWindowStart: this.optionalDate(dto.enrolmentWindowStart),
          enrolmentWindowEnd: this.optionalDate(dto.enrolmentWindowEnd),
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'compensation.benefit_plan.created',
        entityType: 'BenefitPlan',
        entityId: plan.id,
      });
      return plan;
    } catch (error) {
      this.handleUniqueError(error, 'Benefit plan already exists');
    }
  }

  listBenefitPlans(companyId: string, activeOnly = false) {
    return this.prisma.benefitPlan.findMany({
      where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async updateBenefitPlan(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateBenefitPlanDto,
  ) {
    await this.assertBenefitPlan(companyId, id);
    this.assertDateWindow(dto.enrolmentWindowStart, dto.enrolmentWindowEnd);
    const plan = await this.prisma.benefitPlan.update({
      where: { id },
      data: {
        code: dto.code?.toUpperCase(),
        name: dto.name,
        type: dto.type,
        description: dto.description,
        employeeContribution: dto.employeeContribution,
        employerContribution: dto.employerContribution,
        coverageAmount: dto.coverageAmount,
        currency: dto.currency,
        enrolmentWindowStart: this.optionalDate(dto.enrolmentWindowStart),
        enrolmentWindowEnd: this.optionalDate(dto.enrolmentWindowEnd),
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.benefit_plan.updated',
      entityType: 'BenefitPlan',
      entityId: id,
    });
    return plan;
  }

  async enrollBenefit(
    companyId: string,
    actorId: string,
    dto: EnrollBenefitDto,
    selfService = false,
  ) {
    const employeeId = selfService
      ? (await this.employeeForUser(companyId, actorId)).id
      : dto.employeeId;
    if (!employeeId) throw new BadRequestException('Employee is required');
    await this.assertEmployee(companyId, employeeId);
    const plan = await this.assertBenefitPlan(companyId, dto.planId, true);
    this.assertInEnrollmentWindow(plan);
    const enrollment = await this.prisma.benefitEnrollment.upsert({
      where: {
        employeeId_planId_coverageStart: {
          employeeId,
          planId: dto.planId,
          coverageStart: this.toDate(dto.coverageStart),
        },
      },
      create: {
        companyId,
        employeeId,
        planId: dto.planId,
        coverageStart: this.toDate(dto.coverageStart),
        coverageEnd: this.optionalDate(dto.coverageEnd),
        dependents: dto.dependents as Prisma.InputJsonValue,
        employeeContribution: plan.employeeContribution,
        employerContribution: plan.employerContribution,
        notes: dto.notes,
      },
      update: {
        coverageEnd: this.optionalDate(dto.coverageEnd),
        dependents: dto.dependents as Prisma.InputJsonValue,
        notes: dto.notes,
        status: BenefitEnrollmentStatus.PENDING,
      },
      include: { plan: true, employee: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: selfService
        ? 'compensation.benefit.self_enrolled'
        : 'compensation.benefit.enrolled',
      entityType: 'BenefitEnrollment',
      entityId: enrollment.id,
    });
    return enrollment;
  }

  listBenefitEnrollments(
    companyId: string,
    filters: { employeeId?: string; planId?: string; status?: string },
  ) {
    return this.prisma.benefitEnrollment.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.planId ? { planId: filters.planId } : {}),
        ...(filters.status
          ? { status: filters.status as BenefitEnrollmentStatus }
          : {}),
      },
      include: { plan: true, employee: true },
      orderBy: [{ coverageStart: 'desc' }],
    });
  }

  async listMyBenefitEnrollments(companyId: string, userId: string) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.listBenefitEnrollments(companyId, { employeeId: employee.id });
  }

  async decideBenefitEnrollment(
    companyId: string,
    actorId: string,
    id: string,
    status: BenefitEnrollmentStatus,
    notes?: string,
  ) {
    const current = await this.prisma.benefitEnrollment.findFirst({
      where: { companyId, id },
    });
    if (!current) throw new NotFoundException('Benefit enrollment not found');
    const enrollment = await this.prisma.benefitEnrollment.update({
      where: { id },
      data: {
        status,
        notes,
        approvedByUserId:
          status === BenefitEnrollmentStatus.APPROVED ||
          status === BenefitEnrollmentStatus.ACTIVE
            ? actorId
            : undefined,
        approvedAt:
          status === BenefitEnrollmentStatus.APPROVED ||
          status === BenefitEnrollmentStatus.ACTIVE
            ? new Date()
            : undefined,
      },
      include: { plan: true, employee: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'compensation.benefit_enrollment.decided',
      entityType: 'BenefitEnrollment',
      entityId: id,
      metadata: { status },
    });
    return enrollment;
  }

  async createTotalCompensationPdf(
    companyId: string,
    employeeId: string,
    periodYear?: number,
    periodMonth?: number,
  ) {
    const statement = await this.buildTotalCompensationStatement(
      companyId,
      employeeId,
      periodYear,
      periodMonth,
    );
    return this.pdf.createTotalCompensationStatement(statement);
  }

  async createMyTotalCompensationPdf(
    companyId: string,
    userId: string,
    periodYear?: number,
    periodMonth?: number,
  ) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.createTotalCompensationPdf(
      companyId,
      employee.id,
      periodYear,
      periodMonth,
    );
  }

  private async buildTotalCompensationStatement(
    companyId: string,
    employeeId: string,
    periodYear?: number,
    periodMonth?: number,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    const profile = await this.prisma.salaryProfile.findFirst({
      where: { companyId, employeeId, isActive: true },
      include: {
        employee: { include: { department: true } },
        components: { where: { isActive: true }, include: { component: true } },
      },
    });
    if (!profile) throw new NotFoundException('Salary profile not found');
    const year = periodYear ?? new Date().getUTCFullYear();
    const variablePay = await this.prisma.variablePayAward.findMany({
      where: {
        companyId,
        employeeId,
        periodYear: year,
        status: { in: [VariablePayStatus.APPROVED, VariablePayStatus.PAID] },
        ...(periodMonth ? { periodMonth } : {}),
      },
    });
    const allowances = await this.prisma.allowanceRecord.findMany({
      where: {
        companyId,
        employeeId,
        periodYear: year,
        ...(periodMonth ? { periodMonth } : {}),
      },
    });
    const benefits = await this.prisma.benefitEnrollment.findMany({
      where: {
        companyId,
        employeeId,
        status: {
          in: [
            BenefitEnrollmentStatus.APPROVED,
            BenefitEnrollmentStatus.ACTIVE,
          ],
        },
      },
      include: { plan: true },
    });

    const baseSalary = this.decimalToNumber(profile.basicSalary);
    const annualizedBaseSalary = this.money(baseSalary * 12);
    const annualComponentValue = profile.components.reduce(
      (sum, item) =>
        sum +
        this.decimalToNumber(item.amount) *
          this.decimalToNumber(item.quantity) *
          12,
      0,
    );
    const variableValue = variablePay.reduce(
      (sum, item) => sum + this.decimalToNumber(item.amount),
      0,
    );
    const allowanceValue = allowances.reduce(
      (sum, item) => sum + this.decimalToNumber(item.approvedAmount),
      0,
    );
    const benefitValue = benefits.reduce(
      (sum, item) => sum + this.decimalToNumber(item.employerContribution) * 12,
      0,
    );

    return {
      companyName: company?.name || 'Company',
      employeeName: `${profile.employee.firstName} ${profile.employee.lastName}`,
      employeeNo: profile.employee.employeeNo,
      jobTitle: profile.employee.jobTitle,
      department: profile.employee.department?.name,
      periodLabel: periodMonth
        ? `${year}-${String(periodMonth).padStart(2, '0')}`
        : String(year),
      currency: company?.currency || 'LKR',
      baseSalary,
      annualizedBaseSalary,
      salaryComponents: profile.components.map((item) => ({
        name: item.component.name,
        amount:
          this.decimalToNumber(item.amount) *
          this.decimalToNumber(item.quantity),
        quantity: this.decimalToNumber(item.quantity),
      })),
      variablePay: variablePay.map((item) => ({
        name: `${item.type}${item.reason ? ` - ${item.reason}` : ''}`,
        amount: this.decimalToNumber(item.amount),
        status: item.status,
      })),
      allowances: allowances.map((item) => ({
        name: item.type,
        amount: this.decimalToNumber(item.approvedAmount),
        period: `${item.periodYear}-${String(item.periodMonth).padStart(2, '0')}`,
      })),
      benefits: benefits.map((item) => ({
        name: item.plan.name,
        employeeContribution: this.decimalToNumber(item.employeeContribution),
        employerContribution:
          this.decimalToNumber(item.employerContribution) * 12,
        status: item.status,
      })),
      totals: {
        annualCash: this.money(
          annualizedBaseSalary + annualComponentValue + variableValue,
        ),
        allowances: this.money(allowanceValue),
        employerBenefits: this.money(benefitValue),
        totalCompensation: this.money(
          annualizedBaseSalary +
            annualComponentValue +
            variableValue +
            allowanceValue +
            benefitValue,
        ),
      },
    };
  }

  private amountFromPercent(base: number, percent?: number, amount?: number) {
    if (amount != null) return amount;
    if (percent != null) return this.money((base * percent) / 100);
    return undefined;
  }

  private async assertGrade(companyId: string, id: string) {
    const grade = await this.prisma.compensationGrade.findFirst({
      where: { companyId, id },
    });
    if (!grade) throw new NotFoundException('Compensation grade not found');
    return grade;
  }

  private async assertBand(companyId: string, id: string) {
    const band = await this.prisma.compensationBand.findFirst({
      where: { companyId, id },
    });
    if (!band) throw new NotFoundException('Compensation band not found');
    return band;
  }

  private async assertIncrementPlan(companyId: string, id: string) {
    const plan = await this.prisma.annualIncrementPlan.findFirst({
      where: { companyId, id },
    });
    if (!plan) throw new NotFoundException('Increment plan not found');
    return plan;
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('Employee is invalid');
    return employee;
  }

  private async employeeForUser(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee)
      throw new BadRequestException('User is not linked to an employee');
    return employee;
  }

  private async assertSalaryComponent(companyId: string, id: string) {
    const component = await this.prisma.salaryComponent.findFirst({
      where: { companyId, id, isActive: true },
      select: { id: true },
    });
    if (!component)
      throw new BadRequestException('Salary component is invalid');
    return component;
  }

  private async assertVariablePayAward(companyId: string, id: string) {
    const award = await this.prisma.variablePayAward.findFirst({
      where: { companyId, id },
      select: { id: true },
    });
    if (!award) throw new NotFoundException('Variable pay award not found');
    return award;
  }

  private async assertBenefitPlan(
    companyId: string,
    id: string,
    activeOnly = false,
  ) {
    const plan = await this.prisma.benefitPlan.findFirst({
      where: { companyId, id, ...(activeOnly ? { isActive: true } : {}) },
    });
    if (!plan) throw new NotFoundException('Benefit plan not found');
    return plan;
  }

  private assertSalaryRange(
    minSalary: number,
    maxSalary: number,
    midpoint?: number,
  ) {
    if (minSalary > maxSalary) {
      throw new BadRequestException(
        'Minimum salary cannot exceed maximum salary',
      );
    }
    if (midpoint != null && (midpoint < minSalary || midpoint > maxSalary)) {
      throw new BadRequestException('Midpoint must be within the salary range');
    }
  }

  private assertDateWindow(start?: string, end?: string) {
    if (start && end && this.toDate(end) < this.toDate(start)) {
      throw new BadRequestException(
        'Enrollment window end cannot be before start',
      );
    }
  }

  private assertInEnrollmentWindow(plan: {
    enrolmentWindowStart?: Date | null;
    enrolmentWindowEnd?: Date | null;
  }) {
    const now = new Date();
    if (plan.enrolmentWindowStart && now < plan.enrolmentWindowStart) {
      throw new BadRequestException('Enrollment window has not opened');
    }
    if (plan.enrolmentWindowEnd && now > plan.enrolmentWindowEnd) {
      throw new BadRequestException('Enrollment window has closed');
    }
  }

  private optionalDate(value?: string | null) {
    return value ? this.toDate(value) : undefined;
  }

  private toDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Date is invalid');
    return date;
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
