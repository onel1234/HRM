import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  PerformanceCycleStatus,
  UserRole,
} from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import {
  BulkFeedbackRequestDto,
  CheckInQueryDto,
  CompleteCalibrationSessionDto,
  CompleteCheckInDto,
  CreateCalibrationSessionDto,
  CreateCheckInDto,
  CreateFeedbackRequestDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  CreatePipDto,
  DecideSalaryIncrementDto,
  ListPerformanceQueryDto,
  ScheduleCheckInsDto,
  SubmitFeedbackDto,
  SubmitManagerReviewDto,
  SubmitSelfReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePipDto,
  UpdateReviewStatusDto,
  UpsertCalibrationItemDto,
  UpsertSalaryIncrementDto,
} from './dto/performance.dto';
import { PerformanceService } from './performance.service';

@ApiTags('Performance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'performance', version: '1' })
export class PerformanceController {
  constructor(private performance: PerformanceService) {}

  @Post('cycles')
  @Roles(UserRole.HR_MANAGER)
  createCycle(
    @Body() dto: CreatePerformanceCycleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.createCycle(user.companyId, user.id, dto);
  }

  @Get('cycles')
  @Roles(UserRole.MANAGER)
  listCycles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: PerformanceCycleStatus,
  ) {
    return this.performance.listCycles(user.companyId, status);
  }

  @Patch('cycles/:id')
  @Roles(UserRole.HR_MANAGER)
  updateCycle(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceCycleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.updateCycle(user.companyId, user.id, id, dto);
  }

  @Post('cycles/:id/check-ins/schedule')
  @Roles(UserRole.MANAGER)
  scheduleCheckIns(
    @Param('id') id: string,
    @Body() dto: ScheduleCheckInsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.scheduleCheckIns(user.companyId, user.id, id, dto);
  }

  @Post('goals')
  @Roles(UserRole.MANAGER)
  createGoal(
    @Body() dto: CreatePerformanceGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.createGoal(user.companyId, user.id, dto);
  }

  @Get('goals')
  @Roles(UserRole.MANAGER)
  listGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformanceQueryDto,
  ) {
    return this.performance.listGoals(user.companyId, query);
  }

  @Get('goals/me')
  @Roles(UserRole.EMPLOYEE)
  listMyGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.performance.listMyGoals(user.companyId, user.id, cycleId);
  }

  @Patch('goals/:id')
  @Roles(UserRole.MANAGER)
  updateGoal(
    @Param('id') id: string,
    @Body() dto: UpdatePerformanceGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.updateGoal(user.companyId, user.id, id, dto);
  }

  @Post('check-ins')
  @Roles(UserRole.MANAGER)
  createCheckIn(
    @Body() dto: CreateCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.createCheckIn(user.companyId, user.id, dto);
  }

  @Get('check-ins')
  @Roles(UserRole.MANAGER)
  listCheckIns(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CheckInQueryDto,
  ) {
    return this.performance.listCheckIns(user.companyId, query);
  }

  @Patch('check-ins/:id/complete')
  @Roles(UserRole.EMPLOYEE)
  completeCheckIn(
    @Param('id') id: string,
    @Body() dto: CompleteCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.completeCheckIn(user.companyId, user.id, id, dto);
  }

  @Post('feedback')
  @Roles(UserRole.MANAGER)
  requestFeedback(
    @Body() dto: CreateFeedbackRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.requestFeedback(user.companyId, user.id, dto);
  }

  @Post('feedback/bulk')
  @Roles(UserRole.MANAGER)
  requestBulkFeedback(
    @Body() dto: BulkFeedbackRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.requestBulkFeedback(
      user.companyId,
      user.id,
      dto.requests,
    );
  }

  @Get('feedback')
  @Roles(UserRole.MANAGER)
  listFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformanceQueryDto,
  ) {
    return this.performance.listFeedback(user.companyId, query);
  }

  @Get('feedback/me')
  @Roles(UserRole.EMPLOYEE)
  listMyFeedback(@CurrentUser() user: AuthenticatedUser) {
    return this.performance.listMyFeedbackRequests(user.companyId, user.id);
  }

  @Patch('feedback/:id/submit')
  @Roles(UserRole.EMPLOYEE)
  submitFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.submitFeedback(user.companyId, user.id, id, dto);
  }

  @Post('reviews')
  @Roles(UserRole.MANAGER)
  createReview(
    @Body() dto: CreatePerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.createReview(user.companyId, user.id, dto);
  }

  @Get('reviews')
  @Roles(UserRole.MANAGER)
  listReviews(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformanceQueryDto,
  ) {
    return this.performance.listReviews(user.companyId, query);
  }

  @Patch('reviews/:id/self')
  @Roles(UserRole.EMPLOYEE)
  submitSelfReview(
    @Param('id') id: string,
    @Body() dto: SubmitSelfReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.submitSelfReview(user.companyId, user.id, id, dto);
  }

  @Patch('reviews/:id/manager')
  @Roles(UserRole.MANAGER)
  submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitManagerReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.submitManagerReview(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Patch('reviews/:id/status')
  @Roles(UserRole.HR_MANAGER)
  updateReviewStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReviewStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.updateReviewStatus(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('calibration/sessions')
  @Roles(UserRole.HR_MANAGER)
  createCalibrationSession(
    @Body() dto: CreateCalibrationSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.createCalibrationSession(
      user.companyId,
      user.id,
      dto,
    );
  }

  @Get('calibration/sessions')
  @Roles(UserRole.HR_MANAGER)
  listCalibrationSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.performance.listCalibrationSessions(user.companyId, cycleId);
  }

  @Post('calibration/sessions/:id/items')
  @Roles(UserRole.HR_MANAGER)
  upsertCalibrationItem(
    @Param('id') id: string,
    @Body() dto: UpsertCalibrationItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.upsertCalibrationItem(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Patch('calibration/sessions/:id/complete')
  @Roles(UserRole.HR_MANAGER)
  completeCalibrationSession(
    @Param('id') id: string,
    @Body() dto: CompleteCalibrationSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.completeCalibrationSession(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('salary-increments')
  @Roles(UserRole.HR_MANAGER)
  upsertSalaryIncrement(
    @Body() dto: UpsertSalaryIncrementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.upsertSalaryIncrement(user.companyId, user.id, dto);
  }

  @Get('salary-increments')
  @Roles(UserRole.HR_MANAGER)
  listSalaryIncrements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformanceQueryDto,
  ) {
    return this.performance.listSalaryIncrements(user.companyId, query);
  }

  @Patch('salary-increments/:id/decision')
  @Roles(UserRole.HR_MANAGER)
  decideSalaryIncrement(
    @Param('id') id: string,
    @Body() dto: DecideSalaryIncrementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.decideSalaryIncrement(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('pips')
  @Roles(UserRole.MANAGER)
  createPip(@Body() dto: CreatePipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.performance.createPip(user.companyId, user.id, dto);
  }

  @Get('pips')
  @Roles(UserRole.MANAGER)
  listPips(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPerformanceQueryDto,
  ) {
    return this.performance.listPips(user.companyId, query);
  }

  @Patch('pips/:id')
  @Roles(UserRole.MANAGER)
  updatePip(
    @Param('id') id: string,
    @Body() dto: UpdatePipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performance.updatePip(user.companyId, user.id, id, dto);
  }
}
