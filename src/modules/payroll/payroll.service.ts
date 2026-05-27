/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import {
  AttendanceRecordStatus,
  LeaveApplicationStatus,
  LeaveEncashmentStatus,
  LeaveTypeCode,
  OvertimeMultiplier,
  PayRunStatus,
  PayrollExportType,
  PayrollLineItemType,
  Prisma,
  SalaryComponentType,
  StatutoryFilingStatus,
  TaxDeclarationType,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationJob } from '../../queue/processors/notification.processor';
import { QUEUES } from '../../queue/queue.constants';
import {
  CreateBankExportFormatDto,
  CreatePayRunDto,
  CreateSalaryComponentDto,
  EmailPayslipsDto,
  ExportBankDto,
  GenerateT10Dto,
  UpdateBankExportFormatDto,
  UpdateComplianceRuleDto,
  UpdateSalaryComponentDto,
  UpsertSalaryProfileDto,
} from './dto/payroll.dto';
import {
  ComplianceRuleValue,
  PayrollCalculatorService,
  SalaryProfileInput,
} from './payroll-calculator.service';
import { PayrollPdfService } from './payroll-pdf.service';

const APIT_SOURCE =
  'https://www.ird.gov.lk/en/publications/APIT_Tax_Tables/2025-2026/Table%20-%201/02.%20APIT_2526_Table_01_Text.pdf';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private calculator: PayrollCalculatorService,
    private pdf: PayrollPdfService,
    @InjectQueue(QUEUES.NOTIFICATIONS)
    private notifications: Queue<NotificationJob>,
  ) {}

  async createComponent(
    companyId: string,
    actorId: string,
    dto: CreateSalaryComponentDto,
  ) {
    const component = await this.prisma.salaryComponent.create({
      data: {
        companyId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        type: dto.type,
        defaultAmount: dto.defaultAmount || 0,
        taxable: dto.taxable ?? true,
        epfEligible: dto.epfEligible ?? dto.type === SalaryComponentType.BASIC,
        etfEligible: dto.etfEligible ?? dto.type === SalaryComponentType.BASIC,
        apitEligible: dto.apitEligible ?? true,
        visibleOnPayslip: dto.visibleOnPayslip ?? true,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.component.created',
      entityType: 'SalaryComponent',
      entityId: component.id,
      newValues: component as unknown as Prisma.InputJsonValue,
    });
    return component;
  }

  async listComponents(companyId: string) {
    await this.ensureDefaultPayrollSetup(companyId);
    return this.prisma.salaryComponent.findMany({
      where: { companyId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async updateComponent(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateSalaryComponentDto,
  ) {
    await this.assertCompanyComponent(companyId, id);
    const component = await this.prisma.salaryComponent.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code?.toUpperCase(),
        type: dto.type,
        defaultAmount: dto.defaultAmount,
        taxable: dto.taxable,
        epfEligible: dto.epfEligible,
        etfEligible: dto.etfEligible,
        apitEligible: dto.apitEligible,
        visibleOnPayslip: dto.visibleOnPayslip,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.component.updated',
      entityType: 'SalaryComponent',
      entityId: id,
    });
    return component;
  }

  async upsertSalaryProfile(
    companyId: string,
    actorId: string,
    employeeId: string,
    dto: UpsertSalaryProfileDto,
  ) {
    await this.ensureEmployee(companyId, employeeId);
    const effectiveFrom = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : new Date();

    const profile = await this.prisma.$transaction(async (tx) => {
      const salaryProfile = await tx.salaryProfile.upsert({
        where: { employeeId },
        create: {
          companyId,
          employeeId,
          basicSalary: dto.basicSalary,
          standardHoursPerMonth: dto.standardHoursPerMonth || 240,
          paymentMethod: dto.paymentMethod,
          bankName: dto.bankName,
          bankCode: dto.bankCode,
          bankBranchCode: dto.bankBranchCode,
          bankAccountNo: dto.bankAccountNo,
          bankAccountName: dto.bankAccountName,
          epfNumber: dto.epfNumber,
          taxDeclarationType:
            dto.taxDeclarationType || TaxDeclarationType.PRIMARY,
          isPrimaryEmployment: dto.isPrimaryEmployment ?? true,
          epfEnabled: dto.epfEnabled ?? true,
          etfEnabled: dto.etfEnabled ?? true,
          apitEnabled: dto.apitEnabled ?? true,
          overtimeEnabled: dto.overtimeEnabled ?? true,
          establishmentEmployeeCount: dto.establishmentEmployeeCount,
          effectiveFrom,
        },
        update: {
          basicSalary: dto.basicSalary,
          standardHoursPerMonth: dto.standardHoursPerMonth,
          paymentMethod: dto.paymentMethod,
          bankName: dto.bankName,
          bankCode: dto.bankCode,
          bankBranchCode: dto.bankBranchCode,
          bankAccountNo: dto.bankAccountNo,
          bankAccountName: dto.bankAccountName,
          epfNumber: dto.epfNumber,
          taxDeclarationType: dto.taxDeclarationType,
          isPrimaryEmployment: dto.isPrimaryEmployment,
          epfEnabled: dto.epfEnabled,
          etfEnabled: dto.etfEnabled,
          apitEnabled: dto.apitEnabled,
          overtimeEnabled: dto.overtimeEnabled,
          establishmentEmployeeCount: dto.establishmentEmployeeCount,
          effectiveFrom,
          isActive: true,
        },
      });

      if (dto.components) {
        await tx.employeeSalaryComponent.deleteMany({
          where: { salaryProfileId: salaryProfile.id },
        });
        for (const component of dto.components) {
          await this.assertComponentWithClient(
            tx,
            companyId,
            component.componentId,
          );
          await tx.employeeSalaryComponent.create({
            data: {
              salaryProfileId: salaryProfile.id,
              componentId: component.componentId,
              amount: component.amount,
              quantity: component.quantity || 1,
              overtimeMultiplier: component.overtimeMultiplier,
              effectiveFrom,
            },
          });
        }
      }

      await tx.employee.update({
        where: { id: employeeId },
        data: {
          epfNumber: dto.epfNumber,
          bankName: dto.bankName,
          bankCode: dto.bankCode,
          bankBranchCode: dto.bankBranchCode,
          bankAccountNo: dto.bankAccountNo,
          bankAccountName: dto.bankAccountName,
          taxDeclarationType: dto.taxDeclarationType,
          isPrimaryEmployment: dto.isPrimaryEmployment,
          payrollActive: true,
        },
      });

      return tx.salaryProfile.findUnique({
        where: { id: salaryProfile.id },
        include: {
          components: { include: { component: true } },
          employee: true,
        },
      });
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.salary_profile.upserted',
      entityType: 'SalaryProfile',
      entityId: profile?.id,
    });
    return profile;
  }

  async getSalaryProfile(companyId: string, employeeId: string) {
    const profile = await this.prisma.salaryProfile.findFirst({
      where: { companyId, employeeId, isActive: true },
      include: { components: { include: { component: true } }, employee: true },
    });
    if (!profile) throw new NotFoundException('Salary profile not found');
    return profile;
  }

  async createPayRun(companyId: string, actorId: string, dto: CreatePayRunDto) {
    await this.ensureDefaultPayrollSetup(companyId);
    const existing = await this.prisma.payRun.findUnique({
      where: {
        companyId_periodYear_periodMonth: {
          companyId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
        },
      },
    });
    if (existing)
      throw new ConflictException('Pay run already exists for period');

    return this.prisma.payRun.create({
      data: {
        companyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        createdByUserId: actorId,
        filters: {
          departmentId: dto.departmentId,
          employeeIds: dto.employeeIds,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async calculatePayRun(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getEditablePayRun(companyId, payRunId);
    const filters = (payRun.filters || {}) as {
      departmentId?: string;
      employeeIds?: string[];
    };
    const profiles = await this.findProfilesForPayRun(companyId, filters);
    if (!profiles.length)
      throw new BadRequestException('No salary profiles found');

    const rules = await this.getActiveComplianceRules(
      companyId,
      payRun.periodYear,
      payRun.periodMonth,
    );
    const attendanceOvertime = await this.getAttendanceOvertimeForPayRun(
      companyId,
      payRun.periodYear,
      payRun.periodMonth,
      profiles.map((profile) => profile.employeeId),
    );
    const attendanceOvertimeComponent = await this.getOvertimeComponent(
      companyId,
      attendanceOvertime.multiplier,
    );
    const leavePayrollAdjustments = await this.getLeavePayrollAdjustments(
      companyId,
      payRun.periodYear,
      payRun.periodMonth,
      profiles.map((profile) => profile.employeeId),
    );

    const calculated = profiles.map((profile) => ({
      profile,
      result: this.calculator.calculate(
        this.toCalculationInput(
          profile,
          attendanceOvertime.hoursByEmployee.get(profile.employeeId) || 0,
          attendanceOvertime.multiplier,
          attendanceOvertimeComponent,
          leavePayrollAdjustments.get(profile.employeeId),
        ),
        { year: payRun.periodYear, month: payRun.periodMonth },
        rules,
      ),
    }));

    const totals = calculated.reduce(
      (sum, row) => ({
        grossEarnings: sum.grossEarnings + row.result.grossEarnings,
        totalDeductions: sum.totalDeductions + row.result.employeeDeductions,
        totalEmployerContributions:
          sum.totalEmployerContributions + row.result.employerContributions,
        totalNetPay: sum.totalNetPay + row.result.netPay,
        totalApit: sum.totalApit + row.result.apit,
        totalEpfEmployee: sum.totalEpfEmployee + row.result.epfEmployee,
        totalEpfEmployer: sum.totalEpfEmployer + row.result.epfEmployer,
        totalEtfEmployer: sum.totalEtfEmployer + row.result.etfEmployer,
        totalGratuityAccrual:
          sum.totalGratuityAccrual + row.result.gratuityAccrual,
      }),
      {
        grossEarnings: 0,
        totalDeductions: 0,
        totalEmployerContributions: 0,
        totalNetPay: 0,
        totalApit: 0,
        totalEpfEmployee: 0,
        totalEpfEmployer: 0,
        totalEtfEmployer: 0,
        totalGratuityAccrual: 0,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      const existingEmployees = await tx.payRunEmployee.findMany({
        where: { payRunId },
        select: { id: true },
      });
      await tx.payrollLineItem.deleteMany({
        where: {
          payRunEmployeeId: {
            in: existingEmployees.map((employee) => employee.id),
          },
        },
      });
      await tx.payslip.deleteMany({ where: { payRunId } });
      await tx.payRunEmployee.deleteMany({ where: { payRunId } });

      for (const row of calculated) {
        const employee = await tx.payRunEmployee.create({
          data: {
            payRunId,
            companyId,
            employeeId: row.profile.employeeId,
            salaryProfileId: row.profile.id,
            grossEarnings: row.result.grossEarnings,
            taxableEarnings: row.result.taxableEarnings,
            epfEligibleEarnings: row.result.epfEligibleEarnings,
            etfEligibleEarnings: row.result.etfEligibleEarnings,
            employeeDeductions: row.result.employeeDeductions,
            employerContributions: row.result.employerContributions,
            epfEmployee: row.result.epfEmployee,
            epfEmployer: row.result.epfEmployer,
            etfEmployer: row.result.etfEmployer,
            apit: row.result.apit,
            netPay: row.result.netPay,
            gratuityAccrual: row.result.gratuityAccrual,
            validationWarnings: row.result
              .validationWarnings as Prisma.InputJsonValue,
          },
        });

        await tx.payrollLineItem.createMany({
          data: row.result.lines.map((line) => ({
            payRunEmployeeId: employee.id,
            componentId: line.componentId,
            type: line.type,
            code: line.code,
            name: line.name,
            amount: line.amount,
            quantity: line.quantity,
            rate: line.rate,
            taxable: line.taxable,
            epfEligible: line.epfEligible,
            etfEligible: line.etfEligible,
            apitEligible: line.apitEligible,
            metadata: line.metadata as Prisma.InputJsonValue,
          })),
        });

        await tx.gratuityAccrual.upsert({
          where: {
            companyId_employeeId_periodYear_periodMonth: {
              companyId,
              employeeId: row.profile.employeeId,
              periodYear: payRun.periodYear,
              periodMonth: payRun.periodMonth,
            },
          },
          create: {
            companyId,
            employeeId: row.profile.employeeId,
            periodYear: payRun.periodYear,
            periodMonth: payRun.periodMonth,
            serviceYears: row.result.serviceYears,
            completedYears: row.result.completedYears,
            eligible: row.result.gratuityEligible,
            establishmentEmployeeCount: row.profile.establishmentEmployeeCount,
            basisSalary: this.decimalToNumber(row.profile.basicSalary),
            accrualAmount: row.result.gratuityAccrual,
          },
          update: {
            serviceYears: row.result.serviceYears,
            completedYears: row.result.completedYears,
            eligible: row.result.gratuityEligible,
            establishmentEmployeeCount: row.profile.establishmentEmployeeCount,
            basisSalary: this.decimalToNumber(row.profile.basicSalary),
            accrualAmount: row.result.gratuityAccrual,
          },
        });
      }

      await tx.payRun.update({
        where: { id: payRunId },
        data: {
          status: PayRunStatus.CALCULATED,
          employeeCount: calculated.length,
          grossEarnings: this.money(totals.grossEarnings),
          totalDeductions: this.money(totals.totalDeductions),
          totalEmployerContributions: this.money(
            totals.totalEmployerContributions,
          ),
          totalNetPay: this.money(totals.totalNetPay),
          totalApit: this.money(totals.totalApit),
          totalEpfEmployee: this.money(totals.totalEpfEmployee),
          totalEpfEmployer: this.money(totals.totalEpfEmployer),
          totalEtfEmployer: this.money(totals.totalEtfEmployer),
          totalGratuityAccrual: this.money(totals.totalGratuityAccrual),
          calculatedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.pay_run.calculated',
      entityType: 'PayRun',
      entityId: payRunId,
    });
    return this.getPayRun(companyId, payRunId);
  }

  async approvePayRun(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getPayRunRecord(companyId, payRunId);
    if (payRun.status !== PayRunStatus.CALCULATED) {
      throw new BadRequestException('Only calculated pay runs can be approved');
    }
    await this.prisma.payRun.update({
      where: { id: payRunId },
      data: {
        status: PayRunStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: actorId,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.pay_run.approved',
      entityType: 'PayRun',
      entityId: payRunId,
    });
    return this.getPayRun(companyId, payRunId);
  }

  async finalizePayRun(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getPayRunRecord(companyId, payRunId);
    if (payRun.status !== PayRunStatus.APPROVED) {
      throw new BadRequestException('Only approved pay runs can be finalized');
    }
    await this.prisma.payRun.update({
      where: { id: payRunId },
      data: {
        status: PayRunStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedByUserId: actorId,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.pay_run.finalized',
      entityType: 'PayRun',
      entityId: payRunId,
    });
    return this.getPayRun(companyId, payRunId);
  }

  async getPayRun(companyId: string, payRunId: string) {
    const payRun = await this.prisma.payRun.findFirst({
      where: { id: payRunId, companyId },
      include: {
        employees: {
          include: {
            employee: true,
            lineItems: true,
          },
          orderBy: [{ employee: { employeeNo: 'asc' } }, { createdAt: 'asc' }],
        },
      },
    });
    if (!payRun) throw new NotFoundException('Pay run not found');
    return payRun;
  }

  async getPayRunEmployee(
    companyId: string,
    payRunId: string,
    employeeId: string,
  ) {
    const employee = await this.prisma.payRunEmployee.findFirst({
      where: { companyId, payRunId, employeeId },
      include: { employee: true, lineItems: true, salaryProfile: true },
    });
    if (!employee) throw new NotFoundException('Pay run employee not found');
    return employee;
  }

  async getOrCreatePayslip(
    companyId: string,
    payRunId: string,
    employeeId: string,
  ) {
    const existing = await this.prisma.payslip.findFirst({
      where: { companyId, payRunId, employeeId },
    });
    if (existing) return existing;

    const payRun = await this.getPayRunRecord(companyId, payRunId);
    const row = await this.getPayRunEmployee(companyId, payRunId, employeeId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    const pdf = await this.pdf.createPayslip({
      companyName: company?.name || 'Company',
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
      employeeNo: row.employee.employeeNo,
      periodLabel: `${payRun.periodYear}-${String(payRun.periodMonth).padStart(2, '0')}`,
      grossEarnings: this.decimalToNumber(row.grossEarnings),
      employeeDeductions: this.decimalToNumber(row.employeeDeductions),
      employerContributions: this.decimalToNumber(row.employerContributions),
      netPay: this.decimalToNumber(row.netPay),
      epfEmployee: this.decimalToNumber(row.epfEmployee),
      epfEmployer: this.decimalToNumber(row.epfEmployer),
      etfEmployer: this.decimalToNumber(row.etfEmployer),
      apit: this.decimalToNumber(row.apit),
      lines: row.lineItems
        .filter(
          (line) => line.type !== PayrollLineItemType.EMPLOYER_CONTRIBUTION,
        )
        .map((line) => ({
          code: line.code,
          name: line.name,
          amount: this.decimalToNumber(line.amount),
          type: line.type,
        })),
    });
    return this.prisma.payslip.create({
      data: {
        companyId,
        payRunId,
        payRunEmployeeId: row.id,
        employeeId,
        fileName: `payslip-${row.employee.employeeNo || employeeId}-${payRun.periodYear}-${payRun.periodMonth}.pdf`,
        pdfBase64: pdf.toString('base64'),
      },
    });
  }

  async emailPayslips(
    companyId: string,
    actorId: string,
    dto: EmailPayslipsDto,
  ) {
    const payRun = await this.getPayRunRecord(companyId, dto.payRunId);
    if (payRun.status !== PayRunStatus.FINALIZED) {
      throw new BadRequestException(
        'Payslips can be emailed after finalization',
      );
    }
    const employees = await this.prisma.payRunEmployee.findMany({
      where: {
        companyId,
        payRunId: dto.payRunId,
        ...(dto.employeeIds?.length
          ? { employeeId: { in: dto.employeeIds } }
          : {}),
      },
      include: { employee: true },
    });

    for (const row of employees) {
      const email = row.employee.workEmail || row.employee.personalEmail;
      if (!email) continue;
      const payslip = await this.getOrCreatePayslip(
        companyId,
        dto.payRunId,
        row.employeeId,
      );
      await this.notifications.add('send', {
        type: 'email',
        to: email,
        subject: `Payslip ${payRun.periodYear}-${String(payRun.periodMonth).padStart(2, '0')}`,
        body: 'Please find your payslip attached.',
        companyId,
        attachments: [
          {
            filename: payslip.fileName,
            contentBase64: payslip.pdfBase64,
            contentType: payslip.mimeType,
          },
        ],
      });
      await this.prisma.payslip.update({
        where: { id: payslip.id },
        data: { emailedAt: new Date(), emailTo: email },
      });
    }

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.payslips.email_queued',
      entityType: 'PayRun',
      entityId: dto.payRunId,
    });
    return { queued: employees.length };
  }

  async exportEpfR1(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getFinalizedPayRun(companyId, payRunId);
    const csv = this.csv(
      [
        'employeeNo',
        'epfNumber',
        'name',
        'epfEmployee',
        'epfEmployer',
        'total',
      ],
      payRun.employees.map((row) => [
        row.employee.employeeNo || '',
        row.employee.epfNumber || row.salaryProfile.epfNumber || '',
        `${row.employee.firstName} ${row.employee.lastName}`,
        this.decimalToNumber(row.epfEmployee),
        this.decimalToNumber(row.epfEmployer),
        this.decimalToNumber(row.epfEmployee) +
          this.decimalToNumber(row.epfEmployer),
      ]),
    );
    return this.storeFiling(
      companyId,
      actorId,
      payRunId,
      PayrollExportType.EPF_R1,
      'text/csv',
      csv,
    );
  }

  async exportEpfR4(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getFinalizedPayRun(companyId, payRunId);
    const csv = this.csv(
      [
        'period',
        'employeeCount',
        'employeeContribution',
        'employerContribution',
        'total',
      ],
      [
        [
          `${payRun.periodYear}-${String(payRun.periodMonth).padStart(2, '0')}`,
          payRun.employeeCount,
          this.decimalToNumber(payRun.totalEpfEmployee),
          this.decimalToNumber(payRun.totalEpfEmployer),
          this.decimalToNumber(payRun.totalEpfEmployee) +
            this.decimalToNumber(payRun.totalEpfEmployer),
        ],
      ],
    );
    return this.storeFiling(
      companyId,
      actorId,
      payRunId,
      PayrollExportType.EPF_R4,
      'text/csv',
      csv,
    );
  }

  async exportApitRamis(companyId: string, actorId: string, payRunId: string) {
    const payRun = await this.getFinalizedPayRun(companyId, payRunId);
    const csv = this.csv(
      ['employeeNo', 'nic', 'name', 'taxableEarnings', 'apit'],
      payRun.employees.map((row) => [
        row.employee.employeeNo || '',
        row.employee.nicNumber || '',
        `${row.employee.firstName} ${row.employee.lastName}`,
        this.decimalToNumber(row.taxableEarnings),
        this.decimalToNumber(row.apit),
      ]),
    );
    return this.storeFiling(
      companyId,
      actorId,
      payRunId,
      PayrollExportType.APIT_RAMIS,
      'text/csv',
      csv,
    );
  }

  async exportBank(companyId: string, actorId: string, dto: ExportBankDto) {
    const payRun = await this.getFinalizedPayRun(companyId, dto.payRunId);
    const format = await this.getBankFormat(companyId, dto.formatId);
    const fields = format.fields as Array<{ label: string; source: string }>;
    const rows = payRun.employees.map((row) =>
      fields.map((field) => this.exportValue(field.source, row, payRun)),
    );
    const content = this.delimited(
      fields.map((field) => field.label),
      rows,
      format.delimiter,
      format.includeHeader,
    );
    return this.storeFiling(
      companyId,
      actorId,
      dto.payRunId,
      PayrollExportType.BANK_PAYMENT,
      'text/csv',
      content,
    );
  }

  async generateT10(
    companyId: string,
    actorId: string,
    taxYear: string,
    dto: GenerateT10Dto,
  ) {
    const [startYearText] = taxYear.split('-');
    const startYear = Number(startYearText);
    if (!startYear)
      throw new BadRequestException('Tax year must start with a year');
    const from = { year: startYear, month: 4 };
    const to = { year: startYear + 1, month: 3 };
    const payRuns = await this.prisma.payRun.findMany({
      where: {
        companyId,
        status: PayRunStatus.FINALIZED,
        OR: [
          { periodYear: from.year, periodMonth: { gte: from.month } },
          { periodYear: to.year, periodMonth: { lte: to.month } },
        ],
      },
      include: {
        employees: { include: { employee: true } },
      },
      orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
    });

    const totals = new Map<
      string,
      { employee: any; taxable: number; apit: number; gross: number }
    >();
    for (const run of payRuns) {
      for (const row of run.employees) {
        if (dto.employeeId && row.employeeId !== dto.employeeId) continue;
        const current = totals.get(row.employeeId) || {
          employee: row.employee,
          taxable: 0,
          apit: 0,
          gross: 0,
        };
        current.taxable += this.decimalToNumber(row.taxableEarnings);
        current.apit += this.decimalToNumber(row.apit);
        current.gross += this.decimalToNumber(row.grossEarnings);
        totals.set(row.employeeId, current);
      }
    }

    const csv = this.csv(
      [
        'taxYear',
        'employeeNo',
        'nic',
        'name',
        'grossEarnings',
        'taxableEarnings',
        'apitDeducted',
      ],
      Array.from(totals.values()).map((row) => [
        taxYear,
        row.employee.employeeNo || '',
        row.employee.nicNumber || '',
        `${row.employee.firstName} ${row.employee.lastName}`,
        this.money(row.gross),
        this.money(row.taxable),
        this.money(row.apit),
      ]),
    );
    return this.storeFiling(
      companyId,
      actorId,
      undefined,
      PayrollExportType.T10,
      'text/csv',
      csv,
      {
        taxYear,
      },
    );
  }

  async listComplianceRules(companyId: string) {
    await this.ensureDefaultPayrollSetup(companyId);
    return this.prisma.payrollComplianceRule.findMany({
      where: { OR: [{ companyId }, { companyId: null }] },
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
    });
  }

  async upsertComplianceRule(
    companyId: string,
    actorId: string,
    dto: UpdateComplianceRuleDto,
  ) {
    const rule = await this.prisma.payrollComplianceRule.upsert({
      where: {
        companyId_code_effectiveFrom: {
          companyId,
          code: dto.code,
          effectiveFrom: new Date(dto.effectiveFrom),
        },
      },
      create: {
        companyId,
        code: dto.code,
        description: dto.description,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        value: dto.value as Prisma.InputJsonValue,
        sourceUrl: dto.sourceUrl,
      },
      update: {
        description: dto.description,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        value: dto.value as Prisma.InputJsonValue,
        sourceUrl: dto.sourceUrl,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.compliance_rule.upserted',
      entityType: 'PayrollComplianceRule',
      entityId: rule.id,
    });
    return rule;
  }

  async createBankExportFormat(
    companyId: string,
    actorId: string,
    dto: CreateBankExportFormatDto,
  ) {
    if (dto.isDefault) {
      await this.prisma.bankExportFormat.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }
    const format = await this.prisma.bankExportFormat.create({
      data: {
        companyId,
        name: dto.name,
        bankCode: dto.bankCode,
        delimiter: dto.delimiter || ',',
        includeHeader: dto.includeHeader ?? true,
        fields: dto.fields as Prisma.InputJsonValue,
        constants: dto.constants as Prisma.InputJsonValue,
        isDefault: dto.isDefault ?? false,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.bank_export_format.created',
      entityType: 'BankExportFormat',
      entityId: format.id,
    });
    return format;
  }

  async listBankExportFormats(companyId: string) {
    await this.ensureDefaultBankFormat(companyId);
    return this.prisma.bankExportFormat.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async updateBankExportFormat(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateBankExportFormatDto,
  ) {
    await this.assertBankFormat(companyId, id);
    if (dto.isDefault) {
      await this.prisma.bankExportFormat.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }
    const format = await this.prisma.bankExportFormat.update({
      where: { id },
      data: {
        name: dto.name,
        bankCode: dto.bankCode,
        delimiter: dto.delimiter,
        includeHeader: dto.includeHeader,
        fields: dto.fields as Prisma.InputJsonValue,
        constants: dto.constants as Prisma.InputJsonValue,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'payroll.bank_export_format.updated',
      entityType: 'BankExportFormat',
      entityId: id,
    });
    return format;
  }

  private async getActiveComplianceRules(
    companyId: string,
    year: number,
    month: number,
  ): Promise<ComplianceRuleValue[]> {
    await this.ensureDefaultPayrollSetup(companyId);
    const asAt = new Date(year, month - 1, 1);
    const rules = await this.prisma.payrollComplianceRule.findMany({
      where: {
        AND: [
          { OR: [{ companyId }, { companyId: null }] },
          { effectiveFrom: { lte: asAt } },
          { OR: [{ effectiveTo: null }, { effectiveTo: { gte: asAt } }] },
        ],
      },
      orderBy: [{ companyId: 'desc' }, { effectiveFrom: 'desc' }],
    });
    const unique = new Map<string, ComplianceRuleValue>();
    for (const rule of rules) {
      if (!unique.has(rule.code)) {
        unique.set(rule.code, {
          code: rule.code,
          value: rule.value as Record<string, unknown>,
        });
      }
    }
    return Array.from(unique.values());
  }

  private async ensureDefaultPayrollSetup(companyId: string) {
    await Promise.all([
      this.ensureDefaultComponents(companyId),
      this.ensureDefaultComplianceRules(companyId),
      this.ensureDefaultBankFormat(companyId),
    ]);
  }

  private async ensureDefaultComponents(companyId: string) {
    const components = [
      {
        code: 'ALLOWANCE',
        name: 'Allowance',
        type: SalaryComponentType.ALLOWANCE,
        taxable: true,
        epfEligible: true,
        etfEligible: true,
        apitEligible: true,
      },
      {
        code: 'DEDUCTION',
        name: 'Deduction',
        type: SalaryComponentType.DEDUCTION,
        taxable: false,
        epfEligible: false,
        etfEligible: false,
        apitEligible: false,
      },
      {
        code: 'OT15',
        name: 'Overtime 1.5x',
        type: SalaryComponentType.OVERTIME,
        taxable: true,
        epfEligible: false,
        etfEligible: false,
        apitEligible: true,
      },
      {
        code: 'OT20',
        name: 'Overtime 2x',
        type: SalaryComponentType.OVERTIME,
        taxable: true,
        epfEligible: false,
        etfEligible: false,
        apitEligible: true,
      },
      {
        code: 'UNPAID_LEAVE',
        name: 'Unpaid Leave',
        type: SalaryComponentType.DEDUCTION,
        taxable: false,
        epfEligible: false,
        etfEligible: false,
        apitEligible: false,
      },
      {
        code: 'LEAVE_ENCASH',
        name: 'Leave Encashment',
        type: SalaryComponentType.BONUS,
        taxable: true,
        epfEligible: false,
        etfEligible: false,
        apitEligible: true,
      },
    ];
    for (const component of components) {
      await this.prisma.salaryComponent.upsert({
        where: { companyId_code: { companyId, code: component.code } },
        create: { companyId, ...component, isSystem: true },
        update: {},
      });
    }
  }

  private async ensureDefaultComplianceRules(companyId: string) {
    const defaults = [
      {
        code: 'EPF_EMPLOYEE_RATE',
        description: 'Sri Lanka EPF employee contribution rate',
        effectiveFrom: new Date('2025-04-01'),
        value: { rate: 0.08 },
        sourceUrl: 'https://labourdept.gov.lk/epf-division-new/',
      },
      {
        code: 'EPF_EMPLOYER_RATE',
        description: 'Sri Lanka EPF employer contribution rate',
        effectiveFrom: new Date('2025-04-01'),
        value: { rate: 0.12 },
        sourceUrl: 'https://labourdept.gov.lk/epf-division-new/',
      },
      {
        code: 'ETF_EMPLOYER_RATE',
        description: 'Sri Lanka ETF employer contribution rate',
        effectiveFrom: new Date('2025-04-01'),
        value: { rate: 0.03 },
        sourceUrl: 'https://etfb.lk/about-etf-board/',
      },
      {
        code: 'MINIMUM_WAGE',
        description: 'Sri Lanka national minimum monthly wage',
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2025-03-31'),
        value: { monthly: 12500 },
        sourceUrl:
          'https://labourmin.gov.lk/budgetary-relief-allowance-of-workers-amendment/',
      },
      {
        code: 'MINIMUM_WAGE',
        description: 'Sri Lanka national minimum monthly wage',
        effectiveFrom: new Date('2025-04-01'),
        effectiveTo: new Date('2025-12-31'),
        value: { monthly: 27000 },
        sourceUrl:
          'https://labourmin.gov.lk/budgetary-relief-allowance-of-workers-amendment/',
      },
      {
        code: 'MINIMUM_WAGE',
        description: 'Sri Lanka national minimum monthly wage',
        effectiveFrom: new Date('2026-01-01'),
        value: { monthly: 30000 },
        sourceUrl:
          'https://labourmin.gov.lk/budgetary-relief-allowance-of-workers-amendment/',
      },
      {
        code: 'APIT_2025_26_TABLE_01',
        description: 'APIT 2025/26 monthly primary employment table',
        effectiveFrom: new Date('2025-04-01'),
        effectiveTo: new Date('2026-03-31'),
        value: {
          brackets: [
            { min: 0, max: 150000, rate: 0, subtract: 0 },
            { min: 150001, max: 233333, rate: 0.06, subtract: 9000 },
            { min: 233334, max: 275000, rate: 0.18, subtract: 37000 },
            { min: 275001, max: 316667, rate: 0.24, subtract: 53500 },
            { min: 316668, max: 358333, rate: 0.3, subtract: 72500 },
            { min: 358334, max: null, rate: 0.36, subtract: 94000 },
          ],
        },
        sourceUrl: APIT_SOURCE,
      },
    ];

    for (const rule of defaults) {
      await this.prisma.payrollComplianceRule.upsert({
        where: {
          companyId_code_effectiveFrom: {
            companyId,
            code: rule.code,
            effectiveFrom: rule.effectiveFrom,
          },
        },
        create: {
          companyId,
          code: rule.code,
          description: rule.description,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo,
          value: rule.value as Prisma.InputJsonValue,
          sourceUrl: rule.sourceUrl,
        },
        update: {},
      });
    }
  }

  private async ensureDefaultBankFormat(companyId: string) {
    await this.prisma.bankExportFormat.upsert({
      where: {
        companyId_name: { companyId, name: 'Generic Sri Lanka Bank CSV' },
      },
      create: {
        companyId,
        name: 'Generic Sri Lanka Bank CSV',
        delimiter: ',',
        includeHeader: true,
        isDefault: true,
        fields: [
          { label: 'beneficiaryName', source: 'employee.bankAccountName' },
          { label: 'bankCode', source: 'employee.bankCode' },
          { label: 'branchCode', source: 'employee.bankBranchCode' },
          { label: 'accountNo', source: 'employee.bankAccountNo' },
          { label: 'amount', source: 'netPay' },
          { label: 'reference', source: 'reference' },
        ] as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  private async findProfilesForPayRun(
    companyId: string,
    filters: { departmentId?: string; employeeIds?: string[] },
  ) {
    return this.prisma.salaryProfile.findMany({
      where: {
        companyId,
        isActive: true,
        employee: {
          payrollActive: true,
          deletedAt: null,
          ...(filters.departmentId
            ? { departmentId: filters.departmentId }
            : {}),
          ...(filters.employeeIds?.length
            ? { id: { in: filters.employeeIds } }
            : {}),
        },
      },
      include: {
        employee: true,
        components: {
          where: { isActive: true },
          include: { component: true },
        },
      },
    });
  }

  private async getAttendanceOvertimeForPayRun(
    companyId: string,
    year: number,
    month: number,
    employeeIds: string[],
  ) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));
    const records = employeeIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            companyId,
            employeeId: { in: employeeIds },
            status: AttendanceRecordStatus.APPROVED,
            date: { gte: periodStart, lt: periodEnd },
            overtimeHours: { gt: 0 },
          },
          select: { employeeId: true, overtimeHours: true },
        })
      : [];
    const policy = await this.prisma.attendancePolicy.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const hoursByEmployee = new Map<string, number>();
    for (const record of records) {
      hoursByEmployee.set(
        record.employeeId,
        this.money(
          (hoursByEmployee.get(record.employeeId) || 0) +
            this.decimalToNumber(record.overtimeHours),
        ),
      );
    }
    return {
      hoursByEmployee,
      multiplier: policy?.overtimeMultiplier || OvertimeMultiplier.ONE_POINT_FIVE,
    };
  }

  private async getOvertimeComponent(
    companyId: string,
    multiplier: OvertimeMultiplier,
  ) {
    const code =
      multiplier === OvertimeMultiplier.TWO_POINT_ZERO ? 'OT20' : 'OT15';
    return this.prisma.salaryComponent.findFirst({
      where: { companyId, code, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        taxable: true,
        epfEligible: true,
        etfEligible: true,
        apitEligible: true,
      },
    });
  }

  private async getLeavePayrollAdjustments(
    companyId: string,
    year: number,
    month: number,
    employeeIds: string[],
  ) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));
    const adjustments = new Map<
      string,
      { noPayDays: number; encashmentDays: number; encashmentAmount: number }
    >();
    const ensure = (employeeId: string) => {
      const current = adjustments.get(employeeId) || {
        noPayDays: 0,
        encashmentDays: 0,
        encashmentAmount: 0,
      };
      adjustments.set(employeeId, current);
      return current;
    };

    if (!employeeIds.length) return adjustments;

    const noPayApplications = await this.prisma.leaveApplication.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        status: LeaveApplicationStatus.APPROVED,
        leaveType: { code: LeaveTypeCode.NO_PAY },
        startDate: { lt: periodEnd },
        endDate: { gte: periodStart },
      },
      select: { employeeId: true, requestedDays: true },
    });
    for (const application of noPayApplications) {
      const row = ensure(application.employeeId);
      row.noPayDays = this.money(
        row.noPayDays + this.decimalToNumber(application.requestedDays),
      );
    }

    const encashments = await this.prisma.leaveEncashment.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        status: LeaveEncashmentStatus.APPROVED,
        approvedAt: { gte: periodStart, lt: periodEnd },
      },
      select: { employeeId: true, days: true, amount: true },
    });
    for (const encashment of encashments) {
      const row = ensure(encashment.employeeId);
      row.encashmentDays = this.money(
        row.encashmentDays + this.decimalToNumber(encashment.days),
      );
      row.encashmentAmount = this.money(
        row.encashmentAmount + this.decimalToNumber(encashment.amount),
      );
    }

    return adjustments;
  }

  private toCalculationInput(
    profile: any,
    attendanceOvertimeHours = 0,
    attendanceOvertimeMultiplier: OvertimeMultiplier = OvertimeMultiplier.ONE_POINT_FIVE,
    attendanceOvertimeComponent?: {
      id: string;
      code: string;
      name: string;
      taxable: boolean;
      epfEligible: boolean;
      etfEligible: boolean;
      apitEligible: boolean;
    } | null,
    leavePayrollAdjustment?: {
      noPayDays: number;
      encashmentDays: number;
      encashmentAmount: number;
    },
  ): SalaryProfileInput {
    const components = profile.components.map((entry) => ({
      id: entry.component.id,
      code: entry.component.code,
      name: entry.component.name,
      type: entry.component.type,
      amount: this.decimalToNumber(entry.amount),
      quantity: this.decimalToNumber(entry.quantity),
      overtimeMultiplier: entry.overtimeMultiplier,
      taxable: entry.component.taxable,
      epfEligible: entry.component.epfEligible,
      etfEligible: entry.component.etfEligible,
      apitEligible: entry.component.apitEligible,
    }));
    if (attendanceOvertimeHours > 0) {
      components.push({
        id: attendanceOvertimeComponent?.id,
        code:
          attendanceOvertimeComponent?.code ||
          (attendanceOvertimeMultiplier === OvertimeMultiplier.TWO_POINT_ZERO
            ? 'OT20'
            : 'OT15'),
        name: attendanceOvertimeComponent?.name || 'Attendance Overtime',
        type: SalaryComponentType.OVERTIME,
        amount: 0,
        quantity: attendanceOvertimeHours,
        overtimeMultiplier: attendanceOvertimeMultiplier,
        taxable: attendanceOvertimeComponent?.taxable ?? true,
        epfEligible: attendanceOvertimeComponent?.epfEligible ?? false,
        etfEligible: attendanceOvertimeComponent?.etfEligible ?? false,
        apitEligible: attendanceOvertimeComponent?.apitEligible ?? true,
      });
    }
    const dailyRate = this.decimalToNumber(profile.basicSalary) / 30;
    if ((leavePayrollAdjustment?.noPayDays || 0) > 0) {
      components.push({
        id: undefined,
        code: 'UNPAID_LEAVE',
        name: 'Unpaid Leave',
        type: SalaryComponentType.DEDUCTION,
        amount: this.money(dailyRate * (leavePayrollAdjustment?.noPayDays || 0)),
        quantity: 1,
        overtimeMultiplier: null,
        taxable: false,
        epfEligible: false,
        etfEligible: false,
        apitEligible: false,
      });
    }
    if ((leavePayrollAdjustment?.encashmentDays || 0) > 0) {
      const encashmentDays = leavePayrollAdjustment?.encashmentDays || 0;
      const amount =
        leavePayrollAdjustment?.encashmentAmount ||
        this.money(dailyRate * encashmentDays);
      components.push({
        id: undefined,
        code: 'LEAVE_ENCASH',
        name: 'Leave Encashment',
        type: SalaryComponentType.BONUS,
        amount,
        quantity: 1,
        overtimeMultiplier: null,
        taxable: true,
        epfEligible: false,
        etfEligible: false,
        apitEligible: true,
      });
    }
    return {
      employeeId: profile.employeeId,
      employeeName: `${profile.employee.firstName} ${profile.employee.lastName}`,
      joinedAt: profile.employee.joinedAt,
      basicSalary: this.decimalToNumber(profile.basicSalary),
      standardHoursPerMonth:
        this.decimalToNumber(profile.standardHoursPerMonth) || 240,
      overtimeEnabled: profile.overtimeEnabled,
      taxDeclarationType: profile.taxDeclarationType,
      isPrimaryEmployment: profile.isPrimaryEmployment,
      epfEnabled: profile.epfEnabled,
      etfEnabled: profile.etfEnabled,
      apitEnabled: profile.apitEnabled,
      establishmentEmployeeCount: profile.establishmentEmployeeCount,
      components,
    };
  }

  private async storeFiling(
    companyId: string,
    actorId: string,
    payRunId: string | undefined,
    type: PayrollExportType,
    mimeType: string,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const filing = await this.prisma.statutoryFiling.create({
      data: {
        companyId,
        payRunId,
        type,
        status: StatutoryFilingStatus.GENERATED,
        fileName: `${type.toLowerCase()}-${payRunId || Date.now()}.csv`,
        mimeType,
        contentBase64: Buffer.from(content).toString('base64'),
        metadata,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: `payroll.export.${type.toLowerCase()}`,
      entityType: 'StatutoryFiling',
      entityId: filing.id,
    });
    return filing;
  }

  private async getFinalizedPayRun(companyId: string, payRunId: string) {
    const payRun = await this.prisma.payRun.findFirst({
      where: { id: payRunId, companyId, status: PayRunStatus.FINALIZED },
      include: {
        employees: {
          include: {
            employee: true,
            salaryProfile: true,
          },
          orderBy: [{ employee: { employeeNo: 'asc' } }, { createdAt: 'asc' }],
        },
      },
    });
    if (!payRun) throw new BadRequestException('Finalized pay run not found');
    return payRun;
  }

  private async getEditablePayRun(companyId: string, payRunId: string) {
    const payRun = await this.getPayRunRecord(companyId, payRunId);
    if (
      payRun.status !== PayRunStatus.DRAFT &&
      payRun.status !== PayRunStatus.CALCULATED
    ) {
      throw new BadRequestException('Pay run is locked');
    }
    return payRun;
  }

  private async getPayRunRecord(companyId: string, payRunId: string) {
    const payRun = await this.prisma.payRun.findFirst({
      where: { id: payRunId, companyId },
    });
    if (!payRun) throw new NotFoundException('Pay run not found');
    return payRun;
  }

  private async getBankFormat(companyId: string, formatId?: string) {
    await this.ensureDefaultBankFormat(companyId);
    const format = formatId
      ? await this.prisma.bankExportFormat.findFirst({
          where: { id: formatId, companyId, isActive: true },
        })
      : await this.prisma.bankExportFormat.findFirst({
          where: { companyId, isDefault: true, isActive: true },
        });
    if (!format) throw new NotFoundException('Bank export format not found');
    return format;
  }

  private async assertCompanyComponent(companyId: string, id: string) {
    const component = await this.prisma.salaryComponent.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!component) throw new NotFoundException('Salary component not found');
  }

  private async assertComponentWithClient(
    tx: any,
    companyId: string,
    id: string,
  ) {
    const component = await tx.salaryComponent.findFirst({
      where: { id, companyId, isActive: true },
      select: { id: true },
    });
    if (!component)
      throw new BadRequestException('Salary component is invalid');
  }

  private async assertBankFormat(companyId: string, id: string) {
    const format = await this.prisma.bankExportFormat.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!format) throw new NotFoundException('Bank export format not found');
  }

  private async ensureEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  private exportValue(source: string, row: any, payRun: any) {
    const employee = row.employee;
    const values: Record<string, unknown> = {
      netPay: this.decimalToNumber(row.netPay).toFixed(2),
      reference: `${payRun.periodYear}${String(payRun.periodMonth).padStart(2, '0')}-${employee.employeeNo || employee.id}`,
      'employee.bankAccountName': employee.bankAccountName,
      'employee.bankCode': employee.bankCode,
      'employee.bankBranchCode': employee.bankBranchCode,
      'employee.bankAccountNo': employee.bankAccountNo,
      'employee.employeeNo': employee.employeeNo,
      'employee.name': `${employee.firstName} ${employee.lastName}`,
    };
    return values[source] ?? '';
  }

  private csv(headers: string[], rows: unknown[][]) {
    return this.delimited(headers, rows, ',', true);
  }

  private delimited(
    headers: string[],
    rows: unknown[][],
    delimiter: string,
    includeHeader: boolean,
  ) {
    const output: unknown[][] = includeHeader ? [headers] : [];
    output.push(...rows);
    return output
      .map((row) =>
        row
          .map((value) => {
            const text =
              typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value ?? '');
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(delimiter),
      )
      .join('\n');
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
}
