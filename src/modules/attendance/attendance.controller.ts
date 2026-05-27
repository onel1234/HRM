import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AttendanceRecordStatus,
  AttendanceWorkMode,
  UserRole,
} from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { AttendanceService } from './attendance.service';
import {
  ApproveAttendanceRecordDto,
  AttendancePunchDto,
  CreateBiometricDeviceDto,
  CreateQrSessionDto,
  CreateShiftAssignmentDto,
  CreateShiftTemplateDto,
  ImportBiometricPunchesDto,
  UpdateAttendancePolicyDto,
  UpdateAttendanceRecordDto,
  UpdateBiometricDeviceDto,
  UpdateQrSessionDto,
  UpdateShiftAssignmentDto,
  UpdateShiftTemplateDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'attendance', version: '1' })
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get('policy')
  @Roles(UserRole.HR_MANAGER)
  getPolicy(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.getPolicy(user.companyId);
  }

  @Patch('policy')
  @Roles(UserRole.HR_MANAGER)
  updatePolicy(
    @Body() dto: UpdateAttendancePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updatePolicy(user.companyId, user.id, dto);
  }

  @Post('shift-templates')
  @Roles(UserRole.HR_MANAGER)
  createShiftTemplate(
    @Body() dto: CreateShiftTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.createShiftTemplate(user.companyId, user.id, dto);
  }

  @Get('shift-templates')
  @Roles(UserRole.MANAGER)
  listShiftTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.attendance.listShiftTemplates(
      user.companyId,
      includeInactive === 'true',
    );
  }

  @Patch('shift-templates/:id')
  @Roles(UserRole.HR_MANAGER)
  updateShiftTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateShiftTemplate(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Delete('shift-templates/:id')
  @Roles(UserRole.HR_MANAGER)
  removeShiftTemplate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.removeShiftTemplate(user.companyId, user.id, id);
  }

  @Post('shift-assignments')
  @Roles(UserRole.HR_MANAGER)
  createShiftAssignment(
    @Body() dto: CreateShiftAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.createShiftAssignment(user.companyId, user.id, dto);
  }

  @Get('shift-assignments')
  @Roles(UserRole.MANAGER)
  listShiftAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.listShiftAssignments(user.companyId, {
      employeeId,
      from,
      to,
    });
  }

  @Patch('shift-assignments/:id')
  @Roles(UserRole.HR_MANAGER)
  updateShiftAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateShiftAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateShiftAssignment(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('check-in')
  @Roles(UserRole.EMPLOYEE)
  checkIn(
    @Body() dto: AttendancePunchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.checkIn(user.companyId, user.id, dto);
  }

  @Post('check-out')
  @Roles(UserRole.EMPLOYEE)
  checkOut(
    @Body() dto: AttendancePunchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.checkOut(user.companyId, user.id, dto);
  }

  @Get('me')
  @Roles(UserRole.EMPLOYEE)
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: AttendanceRecordStatus,
    @Query('workMode') workMode?: AttendanceWorkMode,
  ) {
    return this.attendance.listMyAttendance(user.companyId, user.id, {
      from,
      to,
      status,
      workMode,
    });
  }

  @Get('records')
  @Roles(UserRole.MANAGER)
  listRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: AttendanceRecordStatus,
    @Query('workMode') workMode?: AttendanceWorkMode,
  ) {
    return this.attendance.listRecords(user.companyId, {
      employeeId,
      from,
      to,
      status,
      workMode,
    });
  }

  @Get('records/:id')
  @Roles(UserRole.MANAGER)
  getRecord(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendance.getRecord(user.companyId, id);
  }

  @Patch('records/:id')
  @Roles(UserRole.HR_MANAGER)
  updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateRecord(user.companyId, user.id, id, dto);
  }

  @Post('records/:id/approve')
  @Roles(UserRole.MANAGER)
  approveRecord(
    @Param('id') id: string,
    @Body() dto: ApproveAttendanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.approveRecord(user.companyId, user.id, id, dto);
  }

  @Post('records/:id/reject')
  @Roles(UserRole.MANAGER)
  rejectRecord(
    @Param('id') id: string,
    @Body() dto: ApproveAttendanceRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.rejectRecord(user.companyId, user.id, id, dto);
  }

  @Get('dashboard/daily')
  @Roles(UserRole.MANAGER)
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date?: string,
    @Query('managerId') managerId?: string,
  ) {
    return this.attendance.dashboard(user.companyId, date, managerId);
  }

  @Post('qr-sessions')
  @Roles(UserRole.HR_MANAGER)
  createQrSession(
    @Body() dto: CreateQrSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.createQrSession(user.companyId, user.id, dto);
  }

  @Get('qr-sessions')
  @Roles(UserRole.HR_MANAGER)
  listQrSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.listQrSessions(user.companyId);
  }

  @Patch('qr-sessions/:id')
  @Roles(UserRole.HR_MANAGER)
  updateQrSession(
    @Param('id') id: string,
    @Body() dto: UpdateQrSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateQrSession(user.companyId, user.id, id, dto);
  }

  @Post('biometric-devices')
  @Roles(UserRole.HR_MANAGER)
  createBiometricDevice(
    @Body() dto: CreateBiometricDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.createBiometricDevice(
      user.companyId,
      user.id,
      dto,
    );
  }

  @Get('biometric-devices')
  @Roles(UserRole.HR_MANAGER)
  listBiometricDevices(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.listBiometricDevices(user.companyId);
  }

  @Patch('biometric-devices/:id')
  @Roles(UserRole.HR_MANAGER)
  updateBiometricDevice(
    @Param('id') id: string,
    @Body() dto: UpdateBiometricDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateBiometricDevice(
      user.companyId,
      user.id,
      id,
      dto,
    );
  }

  @Post('biometric-devices/import-punches')
  @Roles(UserRole.HR_MANAGER)
  importBiometricPunches(
    @Body() dto: ImportBiometricPunchesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.importBiometricPunches(
      user.companyId,
      user.id,
      dto,
    );
  }
}
