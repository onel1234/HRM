import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  CreateBankExportFormatDto,
  CreatePayRunDto,
  CreateSalaryComponentDto,
  EmailPayslipsDto,
  ExportBankDto,
  GenerateT10Dto,
  PayRunIdDto,
  UpdateBankExportFormatDto,
  UpdateComplianceRuleDto,
  UpdateSalaryComponentDto,
  UpsertSalaryProfileDto,
} from './dto/payroll.dto';
import { PayrollService } from './payroll.service';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'payroll', version: '1' })
export class PayrollController {
  constructor(private payroll: PayrollService) {}

  @Post('components')
  @Roles(UserRole.HR_MANAGER)
  createComponent(
    @Body() dto: CreateSalaryComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.createComponent(user.companyId, user.id, dto);
  }

  @Get('components')
  @Roles(UserRole.HR_MANAGER)
  listComponents(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.listComponents(user.companyId);
  }

  @Patch('components/:id')
  @Roles(UserRole.HR_MANAGER)
  updateComponent(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.updateComponent(user.companyId, user.id, id, dto);
  }

  @Post('employees/:employeeId/salary-profile')
  @Roles(UserRole.HR_MANAGER)
  upsertSalaryProfile(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertSalaryProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.upsertSalaryProfile(
      user.companyId,
      user.id,
      employeeId,
      dto,
    );
  }

  @Get('employees/:employeeId/salary-profile')
  @Roles(UserRole.HR_MANAGER)
  getSalaryProfile(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.getSalaryProfile(user.companyId, employeeId);
  }

  @Patch('employees/:employeeId/salary-profile')
  @Roles(UserRole.HR_MANAGER)
  updateSalaryProfile(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertSalaryProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.upsertSalaryProfile(
      user.companyId,
      user.id,
      employeeId,
      dto,
    );
  }

  @Post('pay-runs')
  @Roles(UserRole.HR_MANAGER)
  createPayRun(
    @Body() dto: CreatePayRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.createPayRun(user.companyId, user.id, dto);
  }

  @Post('pay-runs/:id/calculate')
  @Roles(UserRole.HR_MANAGER)
  calculatePayRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.calculatePayRun(user.companyId, user.id, id);
  }

  @Post('pay-runs/:id/approve')
  @Roles(UserRole.HR_MANAGER)
  approvePayRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.approvePayRun(user.companyId, user.id, id);
  }

  @Post('pay-runs/:id/finalize')
  @Roles(UserRole.HR_MANAGER)
  finalizePayRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.finalizePayRun(user.companyId, user.id, id);
  }

  @Get('pay-runs/:id')
  @Roles(UserRole.HR_MANAGER)
  getPayRun(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payroll.getPayRun(user.companyId, id);
  }

  @Get('pay-runs/:id/employees/:employeeId')
  @Roles(UserRole.HR_MANAGER)
  getPayRunEmployee(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.getPayRunEmployee(user.companyId, id, employeeId);
  }

  @Get('pay-runs/:id/payslips/:employeeId.pdf')
  @Roles(UserRole.HR_MANAGER)
  async downloadPayslip(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const payslip = await this.payroll.getOrCreatePayslip(
      user.companyId,
      id,
      employeeId,
    );
    response.setHeader('Content-Type', payslip.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${payslip.fileName}"`,
    );
    response.send(Buffer.from(payslip.pdfBase64, 'base64'));
  }

  @Post('pay-runs/:id/payslips/email')
  @Roles(UserRole.HR_MANAGER)
  emailPayslips(
    @Param('id') id: string,
    @Body() dto: Omit<EmailPayslipsDto, 'payRunId'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.emailPayslips(user.companyId, user.id, {
      ...dto,
      payRunId: id,
    });
  }

  @Post('exports/epf-r1')
  @Roles(UserRole.HR_MANAGER)
  exportEpfR1(
    @Body() dto: PayRunIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.exportEpfR1(user.companyId, user.id, dto.payRunId);
  }

  @Post('exports/epf-r4')
  @Roles(UserRole.HR_MANAGER)
  exportEpfR4(
    @Body() dto: PayRunIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.exportEpfR4(user.companyId, user.id, dto.payRunId);
  }

  @Post('exports/apit-ramis')
  @Roles(UserRole.HR_MANAGER)
  exportApitRamis(
    @Body() dto: PayRunIdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.exportApitRamis(user.companyId, user.id, dto.payRunId);
  }

  @Post('exports/bank')
  @Roles(UserRole.HR_MANAGER)
  exportBank(
    @Body() dto: ExportBankDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.exportBank(user.companyId, user.id, dto);
  }

  @Post('t10/:taxYear/generate')
  @Roles(UserRole.HR_MANAGER)
  generateT10(
    @Param('taxYear') taxYear: string,
    @Body() dto: GenerateT10Dto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.generateT10(user.companyId, user.id, taxYear, dto);
  }

  @Get('compliance-rules')
  @Roles(UserRole.HR_MANAGER)
  listComplianceRules(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.listComplianceRules(user.companyId);
  }

  @Patch('compliance-rules')
  @Roles(UserRole.HR_MANAGER)
  upsertComplianceRule(
    @Body() dto: UpdateComplianceRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.upsertComplianceRule(user.companyId, user.id, dto);
  }

  @Post('bank-export-formats')
  @Roles(UserRole.HR_MANAGER)
  createBankExportFormat(
    @Body() dto: CreateBankExportFormatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.createBankExportFormat(user.companyId, user.id, dto);
  }

  @Get('bank-export-formats')
  @Roles(UserRole.HR_MANAGER)
  listBankExportFormats(@CurrentUser() user: AuthenticatedUser) {
    return this.payroll.listBankExportFormats(user.companyId);
  }

  @Patch('bank-export-formats/:id')
  @Roles(UserRole.HR_MANAGER)
  updateBankExportFormat(
    @Param('id') id: string,
    @Body() dto: UpdateBankExportFormatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payroll.updateBankExportFormat(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }
}
