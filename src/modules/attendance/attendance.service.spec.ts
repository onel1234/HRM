/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  AttendanceAlertStatus: {
    OPEN: 'OPEN',
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    RESOLVED: 'RESOLVED',
  },
  AttendanceAlertType: {
    WEEKLY_HOURS_EXCEEDED: 'WEEKLY_HOURS_EXCEEDED',
    MISSING_CHECK_OUT: 'MISSING_CHECK_OUT',
    LATE_CHECK_IN: 'LATE_CHECK_IN',
    ABSENT: 'ABSENT',
  },
  AttendancePunchDirection: {
    CHECK_IN: 'CHECK_IN',
    CHECK_OUT: 'CHECK_OUT',
  },
  AttendancePunchType: {
    WEB: 'WEB',
    MOBILE_GPS: 'MOBILE_GPS',
    QR: 'QR',
    BIOMETRIC: 'BIOMETRIC',
    MANUAL: 'MANUAL',
  },
  AttendanceRecordStatus: {
    OPEN: 'OPEN',
    PENDING_APPROVAL: 'PENDING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    OVERRIDDEN: 'OVERRIDDEN',
  },
  AttendanceWorkMode: {
    ONSITE: 'ONSITE',
    WFH: 'WFH',
    HYBRID: 'HYBRID',
  },
  LeaveApplicationStatus: {
    APPROVED: 'APPROVED',
  },
  OvertimeMultiplier: {
    ONE_POINT_FIVE: 'ONE_POINT_FIVE',
    TWO_POINT_ZERO: 'TWO_POINT_ZERO',
  },
}));

import { BadRequestException } from '@nestjs/common';
import {
  AttendancePunchDirection,
  AttendancePunchType,
  AttendanceRecordStatus,
  AttendanceWorkMode,
  OvertimeMultiplier,
} from '@prisma/client';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let prisma: any;
  let service: AttendanceService;

  beforeEach(() => {
    prisma = {
      attendancePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'policy-1',
          standardWeeklyHours: 45,
          overtimeMultiplier: OvertimeMultiplier.ONE_POINT_FIVE,
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceRecord: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      attendancePunch: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      attendanceAlert: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      leaveApplication: {
        count: jest.fn(),
      },
      qrCheckInSession: {
        findFirst: jest.fn(),
      },
      biometricDevice: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    jest.clearAllMocks();
    service = new AttendanceService(prisma, audit as any);
  });

  it('creates a tenant-scoped check-in record for the current employee', async () => {
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 'employee-1' })
      .mockResolvedValueOnce({ id: 'employee-1' });
    prisma.attendanceRecord.upsert.mockResolvedValue({
      id: 'record-1',
      employeeId: 'employee-1',
      date: new Date('2026-05-18T00:00:00.000Z'),
    });
    prisma.attendanceRecord.findUnique.mockResolvedValue({
      id: 'record-1',
      punches: [
        {
          type: AttendancePunchType.WEB,
          direction: AttendancePunchDirection.CHECK_IN,
          occurredAt: new Date('2026-05-18T03:30:00.000Z'),
        },
      ],
    });
    prisma.attendanceRecord.update.mockResolvedValue({});
    prisma.attendanceRecord.findFirst.mockResolvedValue({
      id: 'record-1',
      employeeId: 'employee-1',
      workMode: AttendanceWorkMode.WFH,
      punches: [],
      alerts: [],
    });

    await service.checkIn('company-1', 'user-1', {
      occurredAt: '2026-05-18T03:30:00.000Z',
      workMode: AttendanceWorkMode.WFH,
    });

    expect(prisma.attendanceRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_employeeId_date: {
            companyId: 'company-1',
            employeeId: 'employee-1',
            date: new Date('2026-05-18T00:00:00.000Z'),
          },
        },
      }),
    );
    expect(prisma.attendancePunch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          employeeId: 'employee-1',
          type: AttendancePunchType.WEB,
          direction: AttendancePunchDirection.CHECK_IN,
        }),
      }),
    );
  });

  it('rejects expired or invalid QR sessions', async () => {
    prisma.employee.findFirst
      .mockResolvedValueOnce({ id: 'employee-1' })
      .mockResolvedValueOnce({ id: 'employee-1' });
    prisma.qrCheckInSession.findFirst.mockResolvedValue(null);

    await expect(
      service.checkIn('company-1', 'user-1', {
        qrToken: 'expired-token',
        occurredAt: '2026-05-18T03:30:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allocates overtime after 45 approved weekly hours and creates an alert', async () => {
    prisma.attendanceRecord.findMany.mockResolvedValue([
      {
        id: 'record-1',
        companyId: 'company-1',
        employeeId: 'employee-1',
        date: new Date('2026-05-18T00:00:00.000Z'),
        approvedHours: 30,
      },
      {
        id: 'record-2',
        companyId: 'company-1',
        employeeId: 'employee-1',
        date: new Date('2026-05-19T00:00:00.000Z'),
        approvedHours: 20,
      },
    ]);
    prisma.attendanceAlert.findFirst.mockResolvedValue(null);

    await (service as any).recomputeWeeklyOvertime(
      'company-1',
      'employee-1',
      new Date('2026-05-19T00:00:00.000Z'),
    );

    expect(prisma.attendanceRecord.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'record-1' },
      data: { overtimeHours: 0 },
    });
    expect(prisma.attendanceRecord.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'record-2' },
      data: { overtimeHours: 5 },
    });
    expect(prisma.attendanceAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'WEEKLY_HOURS_EXCEEDED',
          employeeId: 'employee-1',
        }),
      }),
    );
  });

  it('deduplicates biometric imports by existing punch records', async () => {
    prisma.biometricDevice.findFirst.mockResolvedValue({
      id: 'device-1',
      serialNumber: 'ZK-1',
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    prisma.attendancePunch.findFirst.mockResolvedValue({ id: 'punch-1' });
    prisma.biometricDevice.update.mockResolvedValue({});

    const result = await service.importBiometricPunches('company-1', 'user-1', {
      serialNumber: 'ZK-1',
      punches: [
        {
          employeeNo: 'E001',
          direction: AttendancePunchDirection.CHECK_IN,
          occurredAt: '2026-05-18T03:30:00.000Z',
          externalPunchId: 'zk-100',
        },
      ],
    });

    expect(result).toEqual({ imported: 0, skipped: 1, errors: [] });
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it('builds manager daily dashboard aggregates', async () => {
    prisma.attendanceRecord.findMany.mockResolvedValue([
      {
        id: 'record-1',
        status: AttendanceRecordStatus.OPEN,
        alerts: [{ id: 'alert-1', status: 'OPEN' }],
      },
      {
        id: 'record-2',
        status: AttendanceRecordStatus.APPROVED,
        alerts: [],
      },
    ]);
    prisma.employee.count.mockResolvedValue(3);
    prisma.leaveApplication.count.mockResolvedValue(1);

    const result = await service.dashboard('company-1', '2026-05-18');

    expect(result.summary).toEqual({
      activeEmployees: 3,
      present: 2,
      approvedLeave: 1,
      absent: 0,
      open: 1,
      approved: 1,
      alerts: 1,
    });
  });
});
