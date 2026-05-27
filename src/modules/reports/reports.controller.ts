import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import {
  AuditLogQueryDto,
  CustomReportDto,
  ReportQueryDto,
  ReportType,
  ScheduleReportEmailDto,
  StatutoryFilingQueryDto,
} from './dto/reports.dto';
import type { ExportedReport } from './reports.service';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('catalog')
  @Roles(UserRole.MANAGER)
  catalog() {
    return this.reports.catalog();
  }

  @Get('entities')
  @Roles(UserRole.COMPANY_ADMIN)
  entities(@CurrentUser() user: AuthenticatedUser) {
    return this.reports.listCompanies(user);
  }

  @Get('headcount')
  @Roles(UserRole.MANAGER)
  async headcount(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.headcount(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(ReportType.HEADCOUNT, data, query.format),
    );
  }

  @Get('turnover')
  @Roles(UserRole.MANAGER)
  async turnover(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.turnover(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(ReportType.TURNOVER, data, query.format),
    );
  }

  @Get('leave')
  @Roles(UserRole.MANAGER)
  async leave(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.leave(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(ReportType.LEAVE, data, query.format),
    );
  }

  @Get('payroll/summary')
  @Roles(UserRole.HR_MANAGER)
  async payrollSummary(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.payrollSummary(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(
        ReportType.PAYROLL_SUMMARY,
        data,
        query.format,
      ),
    );
  }

  @Get('payroll/costs')
  @Roles(UserRole.HR_MANAGER)
  async payrollCosts(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.payrollCost(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(
        ReportType.PAYROLL_COST,
        data,
        query.format,
      ),
    );
  }

  @Get('statutory-filings')
  @Roles(UserRole.HR_MANAGER)
  statutoryFilings(
    @Query() query: StatutoryFilingQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.statutoryFilings(user, query);
  }

  @Get('statutory-filings/:id/download')
  @Roles(UserRole.HR_MANAGER)
  async downloadStatutoryFiling(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    return this.respond(
      response,
      await this.reports.downloadStatutoryFiling(user, id),
    );
  }

  @Get('audit-logs')
  @Roles(UserRole.COMPANY_ADMIN)
  async auditLogs(
    @Query() query: AuditLogQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.auditLogs(user, query);
    return this.respond(
      response,
      await this.reports.exportReport(ReportType.AUDIT_LOG, data, query.format),
    );
  }

  @Post('custom/run')
  @Roles(UserRole.MANAGER)
  async custom(
    @Body() dto: CustomReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const data = await this.reports.runCustom(user, dto);
    return this.respond(
      response,
      await this.reports.exportReport(ReportType.CUSTOM, data, dto.format),
    );
  }

  @Post('schedules/email')
  @Roles(UserRole.HR_MANAGER)
  scheduleEmail(
    @Body() dto: ScheduleReportEmailDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.scheduleEmail(user, dto);
  }

  private respond(response: Response, result: unknown) {
    if (this.isExport(result)) {
      response.setHeader('Content-Type', result.mimeType);
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      response.send(Buffer.from(result.contentBase64, 'base64'));
      return;
    }
    response.json(result);
  }

  private isExport(value: unknown): value is ExportedReport {
    return (
      typeof value === 'object' &&
      value !== null &&
      'contentBase64' in value &&
      'mimeType' in value &&
      'filename' in value
    );
  }
}
