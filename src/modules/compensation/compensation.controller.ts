import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CompensationService } from './compensation.service';
import {
  AddIncrementPlanEmployeesDto,
  AssignCompensationBandDto,
  CompensationStatementQueryDto,
  CreateAnnualIncrementPlanDto,
  CreateBenefitPlanDto,
  CreateCompensationBandDto,
  CreateCompensationGradeDto,
  CreateVariablePayAwardDto,
  DecideBenefitEnrollmentDto,
  EnrollBenefitDto,
  UpsertAllowanceRecordDto,
  UpsertIncrementPlanItemDto,
  UpdateAnnualIncrementPlanDto,
  UpdateBenefitPlanDto,
  UpdateCompensationBandDto,
  UpdateCompensationGradeDto,
  UpdateVariablePayAwardDto,
} from './dto/compensation.dto';

@ApiTags('Compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'compensation', version: '1' })
export class CompensationController {
  constructor(private compensation: CompensationService) {}

  @Post('grades')
  @Roles(UserRole.HR_MANAGER)
  createGrade(
    @Body() dto: CreateCompensationGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.createGrade(user.companyId, user.id, dto);
  }

  @Get('grades')
  @Roles(UserRole.MANAGER)
  listGrades(@CurrentUser() user: AuthenticatedUser) {
    return this.compensation.listGrades(user.companyId);
  }

  @Patch('grades/:id')
  @Roles(UserRole.HR_MANAGER)
  updateGrade(
    @Param('id') id: string,
    @Body() dto: UpdateCompensationGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.updateGrade(user.companyId, user.id, id, dto);
  }

  @Post('bands')
  @Roles(UserRole.HR_MANAGER)
  createBand(
    @Body() dto: CreateCompensationBandDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.createBand(user.companyId, user.id, dto);
  }

  @Get('bands')
  @Roles(UserRole.MANAGER)
  listBands(
    @CurrentUser() user: AuthenticatedUser,
    @Query('gradeId') gradeId?: string,
  ) {
    return this.compensation.listBands(user.companyId, gradeId);
  }

  @Patch('bands/:id')
  @Roles(UserRole.HR_MANAGER)
  updateBand(
    @Param('id') id: string,
    @Body() dto: UpdateCompensationBandDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.updateBand(user.companyId, user.id, id, dto);
  }

  @Patch('employees/:employeeId/band')
  @Roles(UserRole.HR_MANAGER)
  assignEmployeeBand(
    @Param('employeeId') employeeId: string,
    @Body() dto: AssignCompensationBandDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.assignEmployeeBand(
      user.companyId,
      user.id,
      employeeId,
      dto,
    );
  }

  @Post('increment-plans')
  @Roles(UserRole.HR_MANAGER)
  createIncrementPlan(
    @Body() dto: CreateAnnualIncrementPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.createIncrementPlan(user.companyId, user.id, dto);
  }

  @Get('increment-plans')
  @Roles(UserRole.HR_MANAGER)
  listIncrementPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.compensation.listIncrementPlans(
      user.companyId,
      fiscalYear ? Number(fiscalYear) : undefined,
    );
  }

  @Get('increment-plans/:id')
  @Roles(UserRole.HR_MANAGER)
  getIncrementPlan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.getIncrementPlan(user.companyId, id);
  }

  @Patch('increment-plans/:id')
  @Roles(UserRole.HR_MANAGER)
  updateIncrementPlan(
    @Param('id') id: string,
    @Body() dto: UpdateAnnualIncrementPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.updateIncrementPlan(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('increment-plans/:id/employees')
  @Roles(UserRole.HR_MANAGER)
  addEmployeesToIncrementPlan(
    @Param('id') id: string,
    @Body() dto: AddIncrementPlanEmployeesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.addEmployeesToIncrementPlan(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('increment-plans/:id/items')
  @Roles(UserRole.HR_MANAGER)
  upsertIncrementItem(
    @Param('id') id: string,
    @Body() dto: UpsertIncrementPlanItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.upsertIncrementItem(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('increment-plans/:id/apply')
  @Roles(UserRole.HR_MANAGER)
  applyIncrementPlan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.applyIncrementPlan(user.companyId, user.id, id);
  }

  @Post('variable-pay')
  @Roles(UserRole.HR_MANAGER)
  createVariablePayAward(
    @Body() dto: CreateVariablePayAwardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.createVariablePayAward(
      user.companyId,
      user.id,
      dto,
    );
  }

  @Get('variable-pay')
  @Roles(UserRole.HR_MANAGER)
  listVariablePayAwards(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('periodYear') periodYear?: string,
    @Query('status') status?: string,
  ) {
    return this.compensation.listVariablePayAwards(user.companyId, {
      employeeId,
      periodYear: periodYear ? Number(periodYear) : undefined,
      status,
    });
  }

  @Patch('variable-pay/:id')
  @Roles(UserRole.HR_MANAGER)
  updateVariablePayAward(
    @Param('id') id: string,
    @Body() dto: UpdateVariablePayAwardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.updateVariablePayAward(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('allowances')
  @Roles(UserRole.HR_MANAGER)
  upsertAllowance(
    @Body() dto: UpsertAllowanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.upsertAllowanceRecord(
      user.companyId,
      user.id,
      dto,
    );
  }

  @Get('allowances')
  @Roles(UserRole.HR_MANAGER)
  listAllowances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('periodYear') periodYear?: string,
    @Query('periodMonth') periodMonth?: string,
    @Query('type') type?: string,
  ) {
    return this.compensation.listAllowanceRecords(user.companyId, {
      employeeId,
      periodYear: periodYear ? Number(periodYear) : undefined,
      periodMonth: periodMonth ? Number(periodMonth) : undefined,
      type,
    });
  }

  @Post('benefit-plans')
  @Roles(UserRole.HR_MANAGER)
  createBenefitPlan(
    @Body() dto: CreateBenefitPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.createBenefitPlan(user.companyId, user.id, dto);
  }

  @Get('benefit-plans')
  @Roles(UserRole.EMPLOYEE)
  listBenefitPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.compensation.listBenefitPlans(
      user.companyId,
      activeOnly === 'true',
    );
  }

  @Patch('benefit-plans/:id')
  @Roles(UserRole.HR_MANAGER)
  updateBenefitPlan(
    @Param('id') id: string,
    @Body() dto: UpdateBenefitPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.updateBenefitPlan(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('benefit-enrollments')
  @Roles(UserRole.HR_MANAGER)
  enrollBenefit(
    @Body() dto: EnrollBenefitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.enrollBenefit(user.companyId, user.id, dto);
  }

  @Post('benefit-enrollments/me')
  @Roles(UserRole.EMPLOYEE)
  enrollMyBenefit(
    @Body() dto: EnrollBenefitDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.enrollBenefit(user.companyId, user.id, dto, true);
  }

  @Get('benefit-enrollments')
  @Roles(UserRole.HR_MANAGER)
  listBenefitEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('planId') planId?: string,
    @Query('status') status?: string,
  ) {
    return this.compensation.listBenefitEnrollments(user.companyId, {
      employeeId,
      planId,
      status,
    });
  }

  @Get('benefit-enrollments/me')
  @Roles(UserRole.EMPLOYEE)
  listMyBenefitEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.compensation.listMyBenefitEnrollments(user.companyId, user.id);
  }

  @Patch('benefit-enrollments/:id/decision')
  @Roles(UserRole.HR_MANAGER)
  decideBenefitEnrollment(
    @Param('id') id: string,
    @Body() dto: DecideBenefitEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.compensation.decideBenefitEnrollment(
      user.companyId,
      user.id,
      id,
      dto.status,
      dto.notes,
    );
  }

  @Get('statements/:employeeId.pdf')
  @Roles(UserRole.HR_MANAGER)
  async downloadStatement(
    @Param('employeeId') employeeId: string,
    @Query() query: CompensationStatementQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const pdf = await this.compensation.createTotalCompensationPdf(
      user.companyId,
      employeeId,
      query.periodYear,
      query.periodMonth,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="total-compensation-${employeeId}.pdf"`,
    );
    response.send(pdf);
  }

  @Get('statements/me.pdf')
  @Roles(UserRole.EMPLOYEE)
  async downloadMyStatement(
    @Query() query: CompensationStatementQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const pdf = await this.compensation.createMyTotalCompensationPdf(
      user.companyId,
      user.id,
      query.periodYear,
      query.periodMonth,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="total-compensation-statement.pdf"',
    );
    response.send(pdf);
  }
}
