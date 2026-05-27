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
import { LeaveApplicationStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
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
import { LeaveService } from './leave.service';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'leave', version: '1' })
export class LeaveController {
  constructor(private leave: LeaveService) {}

  @Get('types')
  @Roles(UserRole.HR_MANAGER)
  listLeaveTypes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.leave.listLeaveTypes(user.companyId, includeInactive === 'true');
  }

  @Post('types')
  @Roles(UserRole.HR_MANAGER)
  createLeaveType(
    @Body() dto: CreateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.createLeaveType(user.companyId, user.id, dto);
  }

  @Patch('types/:id')
  @Roles(UserRole.HR_MANAGER)
  updateLeaveType(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.updateLeaveType(user.companyId, user.id, id, dto);
  }

  @Patch('policies')
  @Roles(UserRole.HR_MANAGER)
  upsertPolicy(
    @Body() dto: UpdateLeavePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.upsertPolicy(user.companyId, user.id, dto);
  }

  @Post('applications')
  @Roles(UserRole.EMPLOYEE)
  applySelf(
    @Body() dto: ApplyLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.applySelf(user.companyId, user.id, dto);
  }

  @Post('applications/admin')
  @Roles(UserRole.HR_MANAGER)
  createApplication(
    @Body() dto: CreateLeaveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.createApplication(user.companyId, user.id, dto);
  }

  @Get('applications/me')
  @Roles(UserRole.EMPLOYEE)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.leave.listMyApplications(user.companyId, user.id);
  }

  @Patch('applications/:id/cancel')
  @Roles(UserRole.EMPLOYEE)
  cancelOwn(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leave.cancelOwnApplication(user.companyId, user.id, id);
  }

  @Get('applications')
  @Roles(UserRole.MANAGER)
  listApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LeaveApplicationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leave.listApplications(user.companyId, {
      employeeId,
      status,
      from,
      to,
    });
  }

  @Post('applications/:id/approve')
  @Roles(UserRole.MANAGER)
  approveApplication(
    @Param('id') id: string,
    @Body() dto: DecideLeaveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.approveApplication(user.companyId, user.id, id, dto);
  }

  @Post('applications/:id/reject')
  @Roles(UserRole.MANAGER)
  rejectApplication(
    @Param('id') id: string,
    @Body() dto: DecideLeaveApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.rejectApplication(user.companyId, user.id, id, dto);
  }

  @Get('balances/me')
  @Roles(UserRole.EMPLOYEE)
  listMyBalances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: number,
  ) {
    return this.leave.listMyBalances(user.companyId, user.id, year);
  }

  @Get('employees/:employeeId/balances')
  @Roles(UserRole.MANAGER)
  listBalances(
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: number,
  ) {
    return this.leave.listBalances(user.companyId, employeeId, year);
  }

  @Get('holidays/:year')
  @Roles(UserRole.MANAGER)
  listHolidays(
    @Param('year') year: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.listHolidays(user.companyId, Number(year));
  }

  @Patch('holidays/:year')
  @Roles(UserRole.HR_MANAGER)
  upsertHoliday(
    @Param('year') year: number,
    @Body() dto: UpsertHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.upsertHoliday(user.companyId, user.id, Number(year), dto);
  }

  @Get('team-calendar')
  @Roles(UserRole.MANAGER)
  teamCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('managerId') managerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leave.teamCalendar(user.companyId, { managerId, from, to });
  }

  @Post('carry-forward')
  @Roles(UserRole.HR_MANAGER)
  carryForward(
    @Body() dto: CarryForwardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.carryForward(user.companyId, user.id, dto);
  }

  @Post('encashments')
  @Roles(UserRole.HR_MANAGER)
  createEncashment(
    @Body() dto: CreateEncashmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.createEncashment(user.companyId, user.id, dto);
  }

  @Get('encashments')
  @Roles(UserRole.HR_MANAGER)
  listEncashments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.leave.listEncashments(user.companyId, employeeId);
  }

  @Post('encashments/:id/approve')
  @Roles(UserRole.HR_MANAGER)
  approveEncashment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.approveEncashment(user.companyId, user.id, id);
  }

  @Post('encashments/:id/reject')
  @Roles(UserRole.HR_MANAGER)
  rejectEncashment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leave.rejectEncashment(user.companyId, user.id, id);
  }
}
