import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import PDFDocument from 'pdfkit';
import {
  EmployeeStatus,
  LeaveApplicationStatus,
  PayRunStatus,
  Prisma,
  SeparationStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { PrismaService } from '../../database/prisma.service';
import { QUEUES } from '../../queue/queue.constants';
import {
  AuditLogQueryDto,
  CustomReportDto,
  CustomReportEntity,
  ReportExportFormat,
  ReportQueryDto,
  ReportType,
  ScheduleReportEmailDto,
  StatutoryFilingQueryDto,
} from './dto/reports.dto';

export interface ExportedReport {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export interface ReportEmailJob {
  companyId: string;
  actorId: string;
  reportType: ReportType;
  format: ReportExportFormat;
  to: string[];
  subject?: string;
  filters?: Record<string, unknown>;
  customReport?: CustomReportDto;
}

type ReportTable = {
  title: string;
  rows: Array<Record<string, unknown>>;
  summary?: Record<string, unknown>;
};

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(QUEUES.REPORTS)
    private reportsQueue: Queue<ReportEmailJob>,
  ) {}

  catalog() {
    return {
      reports: [
        {
          type: ReportType.HEADCOUNT,
          label: 'Headcount report',
          filters: ['asOf', 'departmentId', 'status', 'companyId'],
          exports: Object.values(ReportExportFormat),
        },
        {
          type: ReportType.TURNOVER,
          label: 'Turnover report',
          filters: ['from', 'to', 'departmentId', 'companyId'],
          exports: Object.values(ReportExportFormat),
        },
        {
          type: ReportType.LEAVE,
          label: 'Leave report',
          filters: ['from', 'to', 'employeeId', 'status', 'companyId'],
          exports: Object.values(ReportExportFormat),
        },
        {
          type: ReportType.PAYROLL_SUMMARY,
          label: 'Payroll summary',
          filters: ['year', 'month', 'departmentId', 'companyId'],
          exports: Object.values(ReportExportFormat),
        },
        {
          type: ReportType.PAYROLL_COST,
          label: 'Payroll cost report',
          filters: ['year', 'month', 'departmentId', 'companyId'],
          exports: Object.values(ReportExportFormat),
        },
        {
          type: ReportType.LABOUR_STATUTORY,
          label: 'Labour Dept statutory filing exports',
          filters: ['type', 'payRunId', 'companyId'],
          exports: [ReportExportFormat.JSON],
        },
        {
          type: ReportType.AUDIT_LOG,
          label: 'Audit log viewer',
          filters: ['from', 'to', 'userId', 'action', 'entityType', 'entityId'],
          exports: Object.values(ReportExportFormat),
        },
      ],
      customBuilder: this.builderMetadata(),
      scheduling: {
        endpoint: 'POST /api/v1/reports/schedules/email',
        supports: ['scheduledAt', 'cron', 'email attachments'],
      },
    };
  }

  builderMetadata() {
    return {
      entities: {
        [CustomReportEntity.EMPLOYEES]: [
          'employeeNo',
          'firstName',
          'lastName',
          'workEmail',
          'department',
          'jobTitle',
          'employmentType',
          'status',
          'joinedAt',
        ],
        [CustomReportEntity.PAYROLL]: [
          'periodYear',
          'periodMonth',
          'employeeNo',
          'employeeName',
          'department',
          'grossEarnings',
          'employeeDeductions',
          'employerContributions',
          'netPay',
          'apit',
          'epfEmployee',
          'epfEmployer',
          'etfEmployer',
        ],
        [CustomReportEntity.LEAVE]: [
          'employeeNo',
          'employeeName',
          'leaveType',
          'status',
          'startDate',
          'endDate',
          'requestedDays',
          'reason',
        ],
        [CustomReportEntity.AUDIT]: [
          'createdAt',
          'action',
          'entityType',
          'entityId',
          'userEmail',
          'metadata',
        ],
      },
      filters: [
        'from',
        'to',
        'departmentId',
        'employeeId',
        'status',
        'year',
        'month',
      ],
    };
  }

  async listCompanies(user: AuthenticatedUser) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          registrationNo: true,
          status: true,
          timezone: true,
          currency: true,
        },
      });
    }

    return this.prisma.company.findMany({
      where: { id: user.companyId },
      select: {
        id: true,
        name: true,
        registrationNo: true,
        status: true,
        timezone: true,
        currency: true,
      },
    });
  }

  async headcount(user: AuthenticatedUser, query: ReportQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const asOf = query.to ? new Date(query.to) : new Date();
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      joinedAt: { lte: asOf },
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.status ? { status: query.status as EmployeeStatus } : {}),
    };

    const employees = await this.prisma.employee.findMany({
      where,
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ department: { name: 'asc' } }, { employeeNo: 'asc' }],
    });

    const rows = employees.map((employee) => ({
      employeeNo: employee.employeeNo,
      employeeName: this.employeeName(employee),
      department: employee.department?.name || 'Unassigned',
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      status: employee.status,
      joinedAt: employee.joinedAt,
    }));

    return {
      title: 'Headcount report',
      asOf,
      total: employees.length,
      byDepartment: this.countBy(rows, 'department'),
      byStatus: this.countBy(rows, 'status'),
      byEmploymentType: this.countBy(rows, 'employmentType'),
      rows,
    };
  }

  async turnover(user: AuthenticatedUser, query: ReportQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const from = query.from ? new Date(query.from) : this.startOfYear();
    const to = query.to ? new Date(query.to) : new Date();
    const departmentFilter = query.departmentId
      ? { departmentId: query.departmentId }
      : {};
    const activeStatuses = [EmployeeStatus.ACTIVE, EmployeeStatus.ON_PROBATION];

    const [startHeadcount, endHeadcount, hires, separations] =
      await Promise.all([
        this.prisma.employee.count({
          where: {
            companyId,
            deletedAt: null,
            joinedAt: { lte: from },
            status: { in: activeStatuses },
            ...departmentFilter,
          },
        }),
        this.prisma.employee.count({
          where: {
            companyId,
            deletedAt: null,
            joinedAt: { lte: to },
            status: { in: activeStatuses },
            ...departmentFilter,
          },
        }),
        this.prisma.employee.count({
          where: {
            companyId,
            deletedAt: null,
            joinedAt: { gte: from, lte: to },
            ...departmentFilter,
          },
        }),
        this.prisma.separationRequest.findMany({
          where: {
            companyId,
            status: {
              in: [SeparationStatus.APPROVED, SeparationStatus.COMPLETED],
            },
            effectiveDate: { gte: from, lte: to },
            employee: departmentFilter,
          },
          include: {
            employee: {
              include: { department: { select: { name: true } } },
            },
          },
          orderBy: { effectiveDate: 'asc' },
        }),
      ]);

    const averageHeadcount = (startHeadcount + endHeadcount) / 2;
    const turnoverRate =
      averageHeadcount > 0
        ? this.round((separations.length / averageHeadcount) * 100)
        : 0;
    const rows = separations.map((separation) => ({
      employeeNo: separation.employee.employeeNo,
      employeeName: this.employeeName(separation.employee),
      department: separation.employee.department?.name || 'Unassigned',
      type: separation.type,
      status: separation.status,
      effectiveDate: separation.effectiveDate,
      reason: separation.reason,
    }));

    return {
      title: 'Turnover report',
      from,
      to,
      startHeadcount,
      endHeadcount,
      averageHeadcount,
      hires,
      separations: separations.length,
      turnoverRate,
      byDepartment: this.countBy(rows, 'department'),
      rows,
    };
  }

  async leave(user: AuthenticatedUser, query: ReportQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const from = query.from ? new Date(query.from) : this.startOfYear();
    const to = query.to ? new Date(query.to) : new Date();

    const applications = await this.prisma.leaveApplication.findMany({
      where: {
        companyId,
        startDate: { lte: to },
        endDate: { gte: from },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.status
          ? { status: query.status as LeaveApplicationStatus }
          : {}),
      },
      include: {
        leaveType: { select: { code: true, name: true, paid: true } },
        employee: {
          include: { department: { select: { name: true } } },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });

    const rows = applications.map((application) => ({
      employeeNo: application.employee.employeeNo,
      employeeName: this.employeeName(application.employee),
      department: application.employee.department?.name || 'Unassigned',
      leaveType: application.leaveType.name,
      leaveCode: application.leaveType.code,
      paid: application.leaveType.paid,
      status: application.status,
      startDate: application.startDate,
      endDate: application.endDate,
      requestedDays: this.decimalToNumber(application.requestedDays),
      reason: application.reason,
    }));

    return {
      title: 'Leave report',
      from,
      to,
      totalApplications: applications.length,
      totalDays: this.round(
        rows.reduce((sum, row) => sum + Number(row.requestedDays), 0),
      ),
      byLeaveType: this.sumBy(rows, 'leaveType', 'requestedDays'),
      byStatus: this.sumBy(rows, 'status', 'requestedDays'),
      rows,
    };
  }

  async payrollSummary(user: AuthenticatedUser, query: ReportQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const payRuns = await this.prisma.payRun.findMany({
      where: {
        companyId,
        ...(query.year ? { periodYear: query.year } : {}),
        ...(query.month ? { periodMonth: query.month } : {}),
        ...(query.departmentId
          ? {
              employees: {
                some: { employee: { departmentId: query.departmentId } },
              },
            }
          : {}),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    const rows = payRuns.map((run) => ({
      payRunId: run.id,
      periodYear: run.periodYear,
      periodMonth: run.periodMonth,
      status: run.status,
      employeeCount: run.employeeCount,
      grossEarnings: this.decimalToNumber(run.grossEarnings),
      totalDeductions: this.decimalToNumber(run.totalDeductions),
      employerContributions: this.decimalToNumber(
        run.totalEmployerContributions,
      ),
      netPay: this.decimalToNumber(run.totalNetPay),
      apit: this.decimalToNumber(run.totalApit),
      epfEmployee: this.decimalToNumber(run.totalEpfEmployee),
      epfEmployer: this.decimalToNumber(run.totalEpfEmployer),
      etfEmployer: this.decimalToNumber(run.totalEtfEmployer),
      gratuityAccrual: this.decimalToNumber(run.totalGratuityAccrual),
    }));

    return {
      title: 'Payroll summary',
      totalPayRuns: rows.length,
      totals: this.payrollTotals(rows),
      rows,
    };
  }

  async payrollCost(user: AuthenticatedUser, query: ReportQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const employees = await this.prisma.payRunEmployee.findMany({
      where: {
        companyId,
        payRun: {
          status: {
            in: [
              PayRunStatus.CALCULATED,
              PayRunStatus.APPROVED,
              PayRunStatus.FINALIZED,
            ],
          },
          ...(query.year ? { periodYear: query.year } : {}),
          ...(query.month ? { periodMonth: query.month } : {}),
        },
        employee: {
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        },
      },
      include: {
        payRun: {
          select: { periodYear: true, periodMonth: true, status: true },
        },
        employee: { include: { department: { select: { name: true } } } },
      },
      orderBy: [{ payRun: { periodYear: 'desc' } }, { createdAt: 'asc' }],
    });

    const rows = employees.map((row) => {
      const grossEarnings = this.decimalToNumber(row.grossEarnings);
      const employerContributions = this.decimalToNumber(
        row.employerContributions,
      );
      return {
        periodYear: row.payRun.periodYear,
        periodMonth: row.payRun.periodMonth,
        employeeNo: row.employee.employeeNo,
        employeeName: this.employeeName(row.employee),
        department: row.employee.department?.name || 'Unassigned',
        grossEarnings,
        employeeDeductions: this.decimalToNumber(row.employeeDeductions),
        employerContributions,
        totalEmployerCost: this.round(grossEarnings + employerContributions),
        netPay: this.decimalToNumber(row.netPay),
      };
    });

    return {
      title: 'Payroll cost report',
      totalEmployerCost: this.round(
        rows.reduce((sum, row) => sum + row.totalEmployerCost, 0),
      ),
      byDepartment: this.sumBy(rows, 'department', 'totalEmployerCost'),
      rows,
    };
  }

  async statutoryFilings(
    user: AuthenticatedUser,
    query: StatutoryFilingQueryDto,
  ) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    return this.prisma.statutoryFiling.findMany({
      where: {
        companyId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.payRunId ? { payRunId: query.payRunId } : {}),
      },
      select: {
        id: true,
        payRunId: true,
        type: true,
        status: true,
        fileName: true,
        mimeType: true,
        metadata: true,
        generatedAt: true,
        submittedAt: true,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async downloadStatutoryFiling(user: AuthenticatedUser, id: string) {
    const filing = await this.prisma.statutoryFiling.findFirst({
      where: { id, companyId: this.resolveCompanyId(user) },
    });
    if (!filing) throw new NotFoundException('Statutory filing not found');
    return {
      filename: filing.fileName,
      mimeType: filing.mimeType,
      contentBase64: filing.contentBase64,
    };
  }

  async auditLogs(user: AuthenticatedUser, query: AuditLogQueryDto) {
    const companyId = this.resolveCompanyId(user, query.companyId);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      companyId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async runCustom(user: AuthenticatedUser, dto: CustomReportDto) {
    const companyId = this.resolveCompanyId(
      user,
      typeof dto.filters?.companyId === 'string'
        ? dto.filters.companyId
        : undefined,
    );
    const allowed = this.builderMetadata().entities[dto.entity];
    const fields = dto.fields.filter((field) => allowed.includes(field));
    if (!fields.length)
      throw new BadRequestException('No valid fields selected');

    const rows = await this.customRows(
      companyId,
      dto.entity,
      dto.filters || {},
    );
    return {
      title: dto.title || 'Custom report',
      entity: dto.entity,
      fields,
      rows: rows.map((row) => this.pick(row, fields)),
    };
  }

  async scheduleEmail(user: AuthenticatedUser, dto: ScheduleReportEmailDto) {
    const companyId = this.resolveCompanyId(
      user,
      typeof dto.filters?.companyId === 'string'
        ? dto.filters.companyId
        : undefined,
    );
    const format = dto.format || ReportExportFormat.CSV;
    const delay = dto.scheduledAt
      ? Math.max(new Date(dto.scheduledAt).getTime() - Date.now(), 0)
      : undefined;
    const job = await this.reportsQueue.add(
      'email-report',
      {
        companyId,
        actorId: user.id,
        reportType: dto.reportType,
        format,
        to: dto.to,
        subject: dto.subject,
        filters: dto.filters,
        customReport: dto.customReport,
      },
      {
        delay,
        repeat: dto.cron ? { cron: dto.cron } : undefined,
        removeOnComplete: true,
      },
    );

    return {
      id: job.id,
      reportType: dto.reportType,
      format,
      to: dto.to,
      scheduledAt: dto.scheduledAt,
      cron: dto.cron,
    };
  }

  async runConfiguredReport(job: ReportEmailJob): Promise<ExportedReport> {
    const user = {
      id: job.actorId,
      companyId: job.companyId,
      role: UserRole.COMPANY_ADMIN,
    };
    const data = await this.reportData(
      user,
      job.reportType,
      job.filters || {},
      job.customReport,
    );
    return this.export(job.reportType, data, job.format);
  }

  async exportReport(
    type: ReportType,
    data: unknown,
    format?: ReportExportFormat,
  ) {
    if (!format || format === ReportExportFormat.JSON) return data;
    return this.export(type, data, format);
  }

  async reportData(
    user: AuthenticatedUser,
    type: ReportType,
    filters: Record<string, unknown>,
    customReport?: CustomReportDto,
  ) {
    const query = filters;
    switch (type) {
      case ReportType.HEADCOUNT:
        return this.headcount(user, query);
      case ReportType.TURNOVER:
        return this.turnover(user, query);
      case ReportType.LEAVE:
        return this.leave(user, query);
      case ReportType.PAYROLL_SUMMARY:
        return this.payrollSummary(user, query);
      case ReportType.PAYROLL_COST:
        return this.payrollCost(user, query);
      case ReportType.LABOUR_STATUTORY:
        return this.statutoryFilings(user, filters);
      case ReportType.AUDIT_LOG:
        return this.auditLogs(user, filters);
      case ReportType.CUSTOM:
        if (!customReport)
          throw new BadRequestException('customReport is required');
        return this.runCustom(user, customReport);
      default:
        throw new BadRequestException('Unsupported report type');
    }
  }

  async export(
    type: ReportType,
    data: unknown,
    format: ReportExportFormat,
  ): Promise<ExportedReport> {
    const table = this.toTable(type, data);
    if (format === ReportExportFormat.PDF) return this.pdf(table);
    if (format === ReportExportFormat.EXCEL) return this.excel(table);
    return this.csv(table);
  }

  private resolveCompanyId(
    user: AuthenticatedUser,
    requestedCompanyId?: string,
  ) {
    if (!requestedCompanyId) return user.companyId;
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      requestedCompanyId !== user.companyId
    ) {
      throw new ForbiddenException('Cannot access another company');
    }
    return requestedCompanyId;
  }

  private async customRows(
    companyId: string,
    entity: CustomReportEntity,
    filters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    switch (entity) {
      case CustomReportEntity.EMPLOYEES:
        return this.employeeRows(companyId, filters);
      case CustomReportEntity.PAYROLL:
        return (
          await this.payrollCost(
            {
              companyId,
              role: UserRole.COMPANY_ADMIN,
              id: '',
            },
            filters,
          )
        ).rows;
      case CustomReportEntity.LEAVE:
        return (
          await this.leave(
            {
              companyId,
              role: UserRole.COMPANY_ADMIN,
              id: '',
            },
            filters,
          )
        ).rows;
      case CustomReportEntity.AUDIT:
        return (
          await this.auditLogs(
            {
              companyId,
              role: UserRole.COMPANY_ADMIN,
              id: '',
            },
            filters,
          )
        ).data.map((row) => ({
          createdAt: row.createdAt,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          userEmail: row.user?.email,
          metadata: row.metadata,
        }));
      default:
        throw new BadRequestException('Unsupported custom report entity');
    }
  }

  private async employeeRows(
    companyId: string,
    filters: Record<string, unknown>,
  ) {
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(typeof filters.departmentId === 'string'
          ? { departmentId: filters.departmentId }
          : {}),
        ...(typeof filters.status === 'string'
          ? { status: filters.status as EmployeeStatus }
          : {}),
      },
      include: { department: { select: { name: true } } },
      orderBy: [{ employeeNo: 'asc' }],
    });
    return rows.map((employee) => ({
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      workEmail: employee.workEmail,
      department: employee.department?.name || 'Unassigned',
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      status: employee.status,
      joinedAt: employee.joinedAt,
    }));
  }

  private payrollTotals(rows: Array<Record<string, unknown>>) {
    return {
      grossEarnings: this.sum(rows, 'grossEarnings'),
      totalDeductions: this.sum(rows, 'totalDeductions'),
      employerContributions: this.sum(rows, 'employerContributions'),
      netPay: this.sum(rows, 'netPay'),
      apit: this.sum(rows, 'apit'),
      epfEmployee: this.sum(rows, 'epfEmployee'),
      epfEmployer: this.sum(rows, 'epfEmployer'),
      etfEmployer: this.sum(rows, 'etfEmployer'),
      gratuityAccrual: this.sum(rows, 'gratuityAccrual'),
    };
  }

  private toTable(type: ReportType, data: unknown): ReportTable {
    const value = data as {
      title?: string;
      rows?: Array<Record<string, unknown>>;
      data?: Array<Record<string, unknown>>;
      summary?: Record<string, unknown>;
      totals?: Record<string, unknown>;
    };
    const rows = value.rows || value.data || (Array.isArray(data) ? data : []);
    return {
      title: value.title || type.replace(/_/g, ' '),
      rows: rows as Array<Record<string, unknown>>,
      summary: value.summary || value.totals,
    };
  }

  private csv(table: ReportTable): ExportedReport {
    const headers = this.headers(table.rows);
    const content = [
      headers.join(','),
      ...table.rows.map((row) =>
        headers.map((header) => this.csvCell(row[header])).join(','),
      ),
    ].join('\n');
    return {
      filename: `${this.slug(table.title)}.csv`,
      mimeType: 'text/csv',
      contentBase64: Buffer.from(content).toString('base64'),
    };
  }

  private excel(table: ReportTable): ExportedReport {
    const headers = this.headers(table.rows);
    const html = [
      '<html><body><table>',
      `<caption>${this.escapeHtml(table.title)}</caption>`,
      '<thead><tr>',
      ...headers.map((header) => `<th>${this.escapeHtml(header)}</th>`),
      '</tr></thead><tbody>',
      ...table.rows.map(
        (row) =>
          `<tr>${headers
            .map(
              (header) =>
                `<td>${this.escapeHtml(this.formatCell(row[header]))}</td>`,
            )
            .join('')}</tr>`,
      ),
      '</tbody></table></body></html>',
    ].join('');
    return {
      filename: `${this.slug(table.title)}.xls`,
      mimeType: 'application/vnd.ms-excel',
      contentBase64: Buffer.from(html).toString('base64'),
    };
  }

  private async pdf(table: ReportTable): Promise<ExportedReport> {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(16).text(table.title, { align: 'center' });
    doc.moveDown();
    if (table.summary) {
      doc.fontSize(10).text('Summary', { underline: true });
      for (const [key, value] of Object.entries(table.summary)) {
        doc.text(`${key}: ${this.formatCell(value)}`);
      }
      doc.moveDown();
    }

    const headers = this.headers(table.rows).slice(0, 6);
    doc.fontSize(9);
    doc.text(headers.join(' | '));
    doc.moveDown(0.4);
    for (const row of table.rows.slice(0, 120)) {
      doc.text(
        headers.map((header) => this.formatCell(row[header])).join(' | '),
      );
    }
    if (table.rows.length > 120) {
      doc.moveDown();
      doc.text(`Showing first 120 of ${table.rows.length} rows.`);
    }
    doc.end();
    const content = await done;

    return {
      filename: `${this.slug(table.title)}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: content.toString('base64'),
    };
  }

  private headers(rows: Array<Record<string, unknown>>) {
    return Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  }

  private countBy(rows: Array<Record<string, unknown>>, key: string) {
    return rows.reduce<Record<string, number>>((output, row) => {
      const group = this.formatCell(row[key] ?? 'Unassigned');
      output[group] = (output[group] || 0) + 1;
      return output;
    }, {});
  }

  private sumBy(
    rows: Array<Record<string, unknown>>,
    groupKey: string,
    valueKey: string,
  ) {
    return rows.reduce<Record<string, number>>((output, row) => {
      const group = this.formatCell(row[groupKey] ?? 'Unassigned');
      output[group] = this.round(
        (output[group] || 0) + Number(row[valueKey] || 0),
      );
      return output;
    }, {});
  }

  private sum(rows: Array<Record<string, unknown>>, key: string) {
    return this.round(
      rows.reduce((total, row) => total + Number(row[key] || 0), 0),
    );
  }

  private pick(row: Record<string, unknown>, fields: string[]) {
    return fields.reduce<Record<string, unknown>>((output, field) => {
      output[field] = row[field];
      return output;
    }, {});
  }

  private csvCell(value: unknown) {
    return `"${this.formatCell(value).replace(/"/g, '""')}"`;
  }

  private formatCell(value: unknown) {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return '';
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private slug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private employeeName(employee: { firstName: string; lastName: string }) {
    return `${employee.firstName} ${employee.lastName}`;
  }

  private startOfYear() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
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

  private round(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}
