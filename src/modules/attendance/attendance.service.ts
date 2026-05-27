/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AttendanceAlertStatus,
  AttendanceAlertType,
  AttendancePunchDirection,
  AttendancePunchType,
  AttendanceRecordStatus,
  AttendanceWorkMode,
  LeaveApplicationStatus,
  OvertimeMultiplier,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
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

interface AttendanceFilters {
  employeeId?: string;
  from?: string;
  to?: string;
  status?: AttendanceRecordStatus;
  workMode?: AttendanceWorkMode;
}

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getPolicy(companyId: string) {
    return this.ensurePolicy(companyId);
  }

  async updatePolicy(
    companyId: string,
    actorId: string,
    dto: UpdateAttendancePolicyDto,
  ) {
    const current = await this.ensurePolicy(companyId);
    const policy = await this.prisma.attendancePolicy.update({
      where: { id: current.id },
      data: {
        name: dto.name,
        standardWeeklyHours: dto.standardWeeklyHours,
        overtimeMultiplier: dto.overtimeMultiplier,
        geofenceEnabled: dto.geofenceEnabled,
        geofence: dto.geofence as Prisma.InputJsonValue,
        settings: dto.settings as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.policy.updated',
      entityType: 'AttendancePolicy',
      entityId: policy.id,
    });
    return policy;
  }

  async createShiftTemplate(
    companyId: string,
    actorId: string,
    dto: CreateShiftTemplateDto,
  ) {
    try {
      const shift = await this.prisma.shiftTemplate.create({
        data: {
          companyId,
          name: dto.name,
          code: dto.code,
          startTime: dto.startTime,
          endTime: dto.endTime,
          breakMinutes: dto.breakMinutes || 0,
          graceMinutes: dto.graceMinutes || 0,
          expectedHours: dto.expectedHours,
          timezone: dto.timezone,
          isOvernight: dto.isOvernight ?? false,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'attendance.shift_template.created',
        entityType: 'ShiftTemplate',
        entityId: shift.id,
      });
      return shift;
    } catch (error) {
      this.handleUniqueError(error, 'Shift code already exists');
    }
  }

  async listShiftTemplates(companyId: string, includeInactive = false) {
    return this.prisma.shiftTemplate.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async updateShiftTemplate(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateShiftTemplateDto,
  ) {
    await this.assertShiftTemplate(companyId, id);
    try {
      const shift = await this.prisma.shiftTemplate.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          startTime: dto.startTime,
          endTime: dto.endTime,
          breakMinutes: dto.breakMinutes,
          graceMinutes: dto.graceMinutes,
          expectedHours: dto.expectedHours,
          timezone: dto.timezone,
          isOvernight: dto.isOvernight,
          isActive: dto.isActive,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'attendance.shift_template.updated',
        entityType: 'ShiftTemplate',
        entityId: id,
      });
      return shift;
    } catch (error) {
      this.handleUniqueError(error, 'Shift code already exists');
    }
  }

  async removeShiftTemplate(companyId: string, actorId: string, id: string) {
    await this.assertShiftTemplate(companyId, id);
    const shift = await this.prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.shift_template.deactivated',
      entityType: 'ShiftTemplate',
      entityId: id,
    });
    return shift;
  }

  async createShiftAssignment(
    companyId: string,
    actorId: string,
    dto: CreateShiftAssignmentDto,
  ) {
    await this.assertEmployee(companyId, dto.employeeId);
    await this.assertShiftTemplate(companyId, dto.shiftTemplateId);
    try {
      const assignment = await this.prisma.shiftAssignment.create({
        data: {
          companyId,
          employeeId: dto.employeeId,
          shiftTemplateId: dto.shiftTemplateId,
          date: this.toDateOnly(dto.date),
          notes: dto.notes,
        },
        include: { employee: true, shiftTemplate: true },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'attendance.shift_assignment.created',
        entityType: 'ShiftAssignment',
        entityId: assignment.id,
      });
      return assignment;
    } catch (error) {
      this.handleUniqueError(error, 'Shift assignment already exists');
    }
  }

  async listShiftAssignments(
    companyId: string,
    filters: { employeeId?: string; from?: string; to?: string },
  ) {
    return this.prisma.shiftAssignment.findMany({
      where: {
        companyId,
        isActive: true,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...this.dateRange(filters.from, filters.to),
      },
      include: { employee: true, shiftTemplate: true },
      orderBy: [{ date: 'asc' }],
    });
  }

  async updateShiftAssignment(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateShiftAssignmentDto,
  ) {
    await this.assertShiftAssignment(companyId, id);
    if (dto.employeeId) await this.assertEmployee(companyId, dto.employeeId);
    if (dto.shiftTemplateId) {
      await this.assertShiftTemplate(companyId, dto.shiftTemplateId);
    }
    const assignment = await this.prisma.shiftAssignment.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        shiftTemplateId: dto.shiftTemplateId,
        date: dto.date ? this.toDateOnly(dto.date) : undefined,
        notes: dto.notes,
        isActive: dto.isActive,
      },
      include: { employee: true, shiftTemplate: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.shift_assignment.updated',
      entityType: 'ShiftAssignment',
      entityId: id,
    });
    return assignment;
  }

  async checkIn(companyId: string, userId: string, dto: AttendancePunchDto) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.recordPunch(companyId, employee.id, userId, {
      ...dto,
      direction: AttendancePunchDirection.CHECK_IN,
    });
  }

  async checkOut(companyId: string, userId: string, dto: AttendancePunchDto) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.recordPunch(companyId, employee.id, userId, {
      ...dto,
      direction: AttendancePunchDirection.CHECK_OUT,
    });
  }

  async listMyAttendance(
    companyId: string,
    userId: string,
    filters: AttendanceFilters,
  ) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.listRecords(companyId, { ...filters, employeeId: employee.id });
  }

  async listRecords(companyId: string, filters: AttendanceFilters) {
    return this.prisma.attendanceRecord.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.workMode ? { workMode: filters.workMode } : {}),
        ...this.dateRange(filters.from, filters.to),
      },
      include: { employee: true, punches: true },
      orderBy: [{ date: 'desc' }, { employee: { employeeNo: 'asc' } }],
    });
  }

  async getRecord(companyId: string, id: string) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { companyId, id },
      include: { employee: true, punches: true, alerts: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  async updateRecord(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateAttendanceRecordDto,
  ) {
    await this.getRecord(companyId, id);
    if (dto.employeeId) await this.assertEmployee(companyId, dto.employeeId);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        date: dto.date ? this.toDateOnly(dto.date) : undefined,
        workMode: dto.workMode,
        status: dto.status,
        firstCheckInAt: dto.firstCheckInAt
          ? new Date(dto.firstCheckInAt)
          : undefined,
        lastCheckOutAt: dto.lastCheckOutAt
          ? new Date(dto.lastCheckOutAt)
          : undefined,
        approvedHours: dto.approvedHours,
        notes: dto.notes,
        managerNotes: dto.managerNotes,
        editedByUserId: actorId,
        sourceSummary: { editedManually: true } as Prisma.InputJsonValue,
      },
      include: { employee: true, punches: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.record.updated',
      entityType: 'AttendanceRecord',
      entityId: id,
    });
    if (
      record.status === AttendanceRecordStatus.APPROVED ||
      dto.approvedHours != null
    ) {
      await this.recomputeWeeklyOvertime(companyId, record.employeeId, record.date);
    }
    return this.getRecord(companyId, id);
  }

  async approveRecord(
    companyId: string,
    actorId: string,
    id: string,
    dto: ApproveAttendanceRecordDto,
  ) {
    const current = await this.getRecord(companyId, id);
    const approvedHours =
      dto.approvedHours ?? this.calculateWorkedHours(current.punches);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: AttendanceRecordStatus.APPROVED,
        approvedHours,
        managerNotes: dto.managerNotes,
        approvedByUserId: actorId,
        approvedAt: new Date(),
        rejectedAt: null,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.record.approved',
      entityType: 'AttendanceRecord',
      entityId: id,
    });
    await this.recomputeWeeklyOvertime(companyId, record.employeeId, record.date);
    return this.getRecord(companyId, id);
  }

  async rejectRecord(
    companyId: string,
    actorId: string,
    id: string,
    dto: ApproveAttendanceRecordDto,
  ) {
    const current = await this.getRecord(companyId, id);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        status: AttendanceRecordStatus.REJECTED,
        approvedHours: 0,
        overtimeHours: 0,
        managerNotes: dto.managerNotes,
        approvedByUserId: actorId,
        rejectedAt: new Date(),
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.record.rejected',
      entityType: 'AttendanceRecord',
      entityId: id,
    });
    await this.recomputeWeeklyOvertime(companyId, current.employeeId, current.date);
    return record;
  }

  async dashboard(companyId: string, date?: string, managerId?: string) {
    const day = this.toDateOnly(date || new Date().toISOString());
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        companyId,
        date: day,
        ...(managerId ? { employee: { reportingManagerId: managerId } } : {}),
      },
      include: { employee: true, punches: true, alerts: true },
      orderBy: [{ employee: { employeeNo: 'asc' } }],
    });
    const activeEmployees = await this.prisma.employee.count({
      where: {
        companyId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'ON_PROBATION'] },
        ...(managerId ? { reportingManagerId: managerId } : {}),
      },
    });
    const approvedLeave = await this.prisma.leaveApplication.count({
      where: {
        companyId,
        status: LeaveApplicationStatus.APPROVED,
        startDate: { lte: day },
        endDate: { gte: day },
        ...(managerId ? { employee: { reportingManagerId: managerId } } : {}),
      },
    });
    const alerts = records.flatMap((record) => record.alerts);
    return {
      date: day,
      summary: {
        activeEmployees,
        present: records.length,
        approvedLeave,
        absent: Math.max(activeEmployees - records.length - approvedLeave, 0),
        open: records.filter((record) => record.status === 'OPEN').length,
        approved: records.filter((record) => record.status === 'APPROVED')
          .length,
        alerts: alerts.filter((alert) => alert.status === 'OPEN').length,
      },
      records,
      alerts,
    };
  }

  async createQrSession(
    companyId: string,
    actorId: string,
    dto: CreateQrSessionDto,
  ) {
    const session = await this.prisma.qrCheckInSession.create({
      data: {
        companyId,
        name: dto.name,
        token: randomUUID(),
        location: dto.location,
        startsAt: new Date(dto.startsAt),
        expiresAt: new Date(dto.expiresAt),
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.qr_session.created',
      entityType: 'QrCheckInSession',
      entityId: session.id,
    });
    return session;
  }

  async listQrSessions(companyId: string) {
    return this.prisma.qrCheckInSession.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async updateQrSession(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateQrSessionDto,
  ) {
    await this.assertQrSession(companyId, id);
    const session = await this.prisma.qrCheckInSession.update({
      where: { id },
      data: {
        name: dto.name,
        location: dto.location,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.qr_session.updated',
      entityType: 'QrCheckInSession',
      entityId: id,
    });
    return session;
  }

  async createBiometricDevice(
    companyId: string,
    actorId: string,
    dto: CreateBiometricDeviceDto,
  ) {
    try {
      const device = await this.prisma.biometricDevice.create({
        data: {
          companyId,
          name: dto.name,
          serialNumber: dto.serialNumber,
          location: dto.location,
          apiBaseUrl: dto.apiBaseUrl,
          metadata: dto.metadata as Prisma.InputJsonValue,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'attendance.biometric_device.created',
        entityType: 'BiometricDevice',
        entityId: device.id,
      });
      return device;
    } catch (error) {
      this.handleUniqueError(error, 'Biometric serial number already exists');
    }
  }

  async listBiometricDevices(companyId: string) {
    return this.prisma.biometricDevice.findMany({
      where: { companyId },
      orderBy: [{ name: 'asc' }],
    });
  }

  async updateBiometricDevice(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateBiometricDeviceDto,
  ) {
    await this.assertBiometricDevice(companyId, id);
    const device = await this.prisma.biometricDevice.update({
      where: { id },
      data: {
        name: dto.name,
        serialNumber: dto.serialNumber,
        location: dto.location,
        apiBaseUrl: dto.apiBaseUrl,
        metadata: dto.metadata as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.biometric_device.updated',
      entityType: 'BiometricDevice',
      entityId: id,
    });
    return device;
  }

  async importBiometricPunches(
    companyId: string,
    actorId: string,
    dto: ImportBiometricPunchesDto,
  ) {
    const device = await this.resolveBiometricDevice(companyId, dto);
    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const punch of dto.punches) {
      try {
        const employee = await this.resolvePunchEmployee(companyId, punch);
        const existing = await this.findExistingBiometricPunch(
          companyId,
          device.id,
          employee.id,
          punch,
        );
        if (existing) {
          result.skipped += 1;
          continue;
        }
        await this.recordPunch(companyId, employee.id, actorId, {
          type: AttendancePunchType.BIOMETRIC,
          direction: punch.direction,
          occurredAt: punch.occurredAt,
          latitude: punch.latitude,
          longitude: punch.longitude,
          accuracyMeters: punch.accuracyMeters,
          externalPunchId: punch.externalPunchId,
          deviceUserId: punch.deviceUserId,
          biometricDeviceId: device.id,
          rawPayload: punch.rawPayload,
        });
        result.imported += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    await this.prisma.biometricDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date() },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'attendance.biometric_punches.imported',
      entityType: 'BiometricDevice',
      entityId: device.id,
      metadata: result as Prisma.InputJsonValue,
    });
    return result;
  }

  private async recordPunch(
    companyId: string,
    employeeId: string,
    actorId: string,
    input: AttendancePunchDto & {
      direction: AttendancePunchDirection;
      biometricDeviceId?: string;
      deviceUserId?: string;
      rawPayload?: Record<string, unknown>;
    },
  ) {
    await this.assertEmployee(companyId, employeeId);
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    const type = input.qrToken ? AttendancePunchType.QR : input.type || AttendancePunchType.WEB;
    const qrSession = input.qrToken
      ? await this.validateQrToken(companyId, input.qrToken, occurredAt)
      : null;
    const date = this.toDateOnly(occurredAt.toISOString());

    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        companyId_employeeId_date: { companyId, employeeId, date },
      },
      create: {
        companyId,
        employeeId,
        date,
        workMode: input.workMode || AttendanceWorkMode.ONSITE,
        status:
          input.direction === AttendancePunchDirection.CHECK_OUT
            ? AttendanceRecordStatus.PENDING_APPROVAL
            : AttendanceRecordStatus.OPEN,
        firstCheckInAt:
          input.direction === AttendancePunchDirection.CHECK_IN
            ? occurredAt
            : undefined,
        lastCheckOutAt:
          input.direction === AttendancePunchDirection.CHECK_OUT
            ? occurredAt
            : undefined,
      },
      update: {
        workMode: input.workMode,
        status:
          input.direction === AttendancePunchDirection.CHECK_OUT
            ? AttendanceRecordStatus.PENDING_APPROVAL
            : undefined,
        firstCheckInAt:
          input.direction === AttendancePunchDirection.CHECK_IN
            ? occurredAt
            : undefined,
        lastCheckOutAt:
          input.direction === AttendancePunchDirection.CHECK_OUT
            ? occurredAt
            : undefined,
      },
    });

    await this.prisma.attendancePunch.create({
      data: {
        companyId,
        employeeId,
        attendanceRecordId: record.id,
        biometricDeviceId: input.biometricDeviceId,
        qrSessionId: qrSession?.id,
        type,
        direction: input.direction,
        occurredAt,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        externalPunchId: input.externalPunchId,
        deviceUserId: input.deviceUserId,
        notes: input.notes,
        rawPayload: input.rawPayload as Prisma.InputJsonValue,
      },
    });

    await this.refreshRecordFromPunches(record.id);
    await this.audit.log({
      companyId,
      userId: actorId,
      action: `attendance.${input.direction.toLowerCase()}`,
      entityType: 'AttendanceRecord',
      entityId: record.id,
      metadata: { type } as Prisma.InputJsonValue,
    });
    return this.getRecord(companyId, record.id);
  }

  private async refreshRecordFromPunches(recordId: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { punches: true },
    });
    if (!record) return;
    const checkIns = record.punches
      .filter((punch) => punch.direction === AttendancePunchDirection.CHECK_IN)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const checkOuts = record.punches
      .filter((punch) => punch.direction === AttendancePunchDirection.CHECK_OUT)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        firstCheckInAt: checkIns[0]?.occurredAt,
        lastCheckOutAt: checkOuts[checkOuts.length - 1]?.occurredAt,
        sourceSummary: this.sourceSummary(record.punches) as Prisma.InputJsonValue,
      },
    });
  }

  private async recomputeWeeklyOvertime(
    companyId: string,
    employeeId: string,
    date: Date,
  ) {
    const policy = await this.ensurePolicy(companyId);
    const standardWeeklyHours = this.decimalToNumber(policy.standardWeeklyHours);
    const { weekStart, weekEnd } = this.weekRange(date);
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        companyId,
        employeeId,
        status: AttendanceRecordStatus.APPROVED,
        date: { gte: weekStart, lte: weekEnd },
      },
      orderBy: [{ date: 'asc' }],
    });
    let cumulative = 0;
    let overtimeCreated = false;
    for (const record of records) {
      const hours = this.decimalToNumber(record.approvedHours);
      const before = Math.max(cumulative - standardWeeklyHours, 0);
      cumulative += hours;
      const after = Math.max(cumulative - standardWeeklyHours, 0);
      const overtimeHours = this.money(after - before);
      await this.prisma.attendanceRecord.update({
        where: { id: record.id },
        data: { overtimeHours },
      });
      overtimeCreated = overtimeCreated || overtimeHours > 0;
    }
    if (overtimeCreated) {
      const existing = await this.prisma.attendanceAlert.findFirst({
        where: {
          companyId,
          employeeId,
          type: AttendanceAlertType.WEEKLY_HOURS_EXCEEDED,
          status: AttendanceAlertStatus.OPEN,
          metadata: { path: ['weekStart'], equals: weekStart.toISOString() },
        },
      });
      if (!existing) {
        await this.prisma.attendanceAlert.create({
          data: {
            companyId,
            employeeId,
            type: AttendanceAlertType.WEEKLY_HOURS_EXCEEDED,
            message: `Weekly approved hours exceeded ${standardWeeklyHours} hours.`,
            metadata: {
              weekStart: weekStart.toISOString(),
              weekEnd: weekEnd.toISOString(),
              standardWeeklyHours,
              approvedHours: this.money(cumulative),
            } as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  private calculateWorkedHours(
    punches: Array<{
      direction: AttendancePunchDirection;
      occurredAt: Date;
    }>,
  ) {
    const sorted = [...punches].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
    let openCheckIn: Date | undefined;
    let totalMs = 0;
    for (const punch of sorted) {
      if (punch.direction === AttendancePunchDirection.CHECK_IN) {
        openCheckIn = punch.occurredAt;
      }
      if (
        punch.direction === AttendancePunchDirection.CHECK_OUT &&
        openCheckIn
      ) {
        totalMs += Math.max(0, punch.occurredAt.getTime() - openCheckIn.getTime());
        openCheckIn = undefined;
      }
    }
    return this.money(totalMs / 3600000);
  }

  private sourceSummary(punches: Array<{ type: AttendancePunchType }>) {
    return punches.reduce<Record<string, number>>((summary, punch) => {
      summary[punch.type] = (summary[punch.type] || 0) + 1;
      return summary;
    }, {});
  }

  private async ensurePolicy(companyId: string) {
    const existing = await this.prisma.attendancePolicy.findFirst({
      where: { companyId, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.attendancePolicy.create({
      data: {
        companyId,
        isDefault: true,
        standardWeeklyHours: 45,
        overtimeMultiplier: OvertimeMultiplier.ONE_POINT_FIVE,
      },
    });
  }

  private async employeeForUser(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('User is not linked to an employee');
    return employee;
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('Employee is invalid');
  }

  private async assertShiftTemplate(companyId: string, id: string) {
    const shift = await this.prisma.shiftTemplate.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!shift) throw new NotFoundException('Shift template not found');
  }

  private async assertShiftAssignment(companyId: string, id: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Shift assignment not found');
  }

  private async assertQrSession(companyId: string, id: string) {
    const session = await this.prisma.qrCheckInSession.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('QR session not found');
  }

  private async assertBiometricDevice(companyId: string, id: string) {
    const device = await this.prisma.biometricDevice.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!device) throw new NotFoundException('Biometric device not found');
  }

  private async validateQrToken(
    companyId: string,
    token: string,
    at: Date,
  ) {
    const session = await this.prisma.qrCheckInSession.findFirst({
      where: {
        companyId,
        token,
        isActive: true,
        startsAt: { lte: at },
        expiresAt: { gte: at },
      },
    });
    if (!session) throw new BadRequestException('QR session is invalid or expired');
    return session;
  }

  private async resolveBiometricDevice(
    companyId: string,
    dto: ImportBiometricPunchesDto,
  ) {
    const device = dto.deviceId
      ? await this.prisma.biometricDevice.findFirst({
          where: { companyId, id: dto.deviceId, isActive: true },
        })
      : await this.prisma.biometricDevice.findFirst({
          where: { companyId, serialNumber: dto.serialNumber, isActive: true },
        });
    if (!device) throw new BadRequestException('Biometric device is invalid');
    return device;
  }

  private async resolvePunchEmployee(
    companyId: string,
    punch: { employeeId?: string; employeeNo?: string; deviceUserId?: string },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyId,
        deletedAt: null,
        ...(punch.employeeId
          ? { id: punch.employeeId }
          : { employeeNo: punch.employeeNo || punch.deviceUserId }),
      },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('Punch employee is invalid');
    return employee;
  }

  private async findExistingBiometricPunch(
    companyId: string,
    biometricDeviceId: string,
    employeeId: string,
    punch: {
      externalPunchId?: string;
      occurredAt: string;
      direction: AttendancePunchDirection;
    },
  ) {
    return this.prisma.attendancePunch.findFirst({
      where: {
        companyId,
        biometricDeviceId,
        employeeId,
        direction: punch.direction,
        ...(punch.externalPunchId
          ? { externalPunchId: punch.externalPunchId }
          : { occurredAt: new Date(punch.occurredAt) }),
      },
      select: { id: true },
    });
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) return {};
    return {
      date: {
        ...(from ? { gte: this.toDateOnly(from) } : {}),
        ...(to ? { lte: this.toDateOnly(to) } : {}),
      },
    };
  }

  private weekRange(date: Date) {
    const weekStart = this.toDateOnly(date.toISOString());
    const day = weekStart.getUTCDay();
    const offset = day === 0 ? -6 : 1 - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + offset);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    return { weekStart, weekEnd };
  }

  private toDateOnly(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date is invalid');
    }
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
