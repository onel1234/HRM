/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  HolidayCategory: {
    BANK: 'BANK',
    PUBLIC: 'PUBLIC',
    MERCANTILE: 'MERCANTILE',
  },
  LeaveApplicationStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
  },
  LeaveDayPart: {
    FULL_DAY: 'FULL_DAY',
    HALF_DAY_AM: 'HALF_DAY_AM',
    HALF_DAY_PM: 'HALF_DAY_PM',
  },
  LeaveEncashmentStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PAID: 'PAID',
  },
  LeaveLedgerEntryType: {
    ACCRUAL: 'ACCRUAL',
    APPLICATION_APPROVED: 'APPLICATION_APPROVED',
    APPLICATION_REVERSED: 'APPLICATION_REVERSED',
    CARRY_FORWARD: 'CARRY_FORWARD',
    ENCASHMENT: 'ENCASHMENT',
    MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
    EXPIRY: 'EXPIRY',
  },
  LeaveTypeCode: {
    ANNUAL: 'ANNUAL',
    CASUAL: 'CASUAL',
    SICK: 'SICK',
    MATERNITY: 'MATERNITY',
    PATERNITY: 'PATERNITY',
    NO_PAY: 'NO_PAY',
  },
}));

import { BadRequestException } from '@nestjs/common';
import {
  LeaveApplicationStatus,
  LeaveDayPart,
  LeaveLedgerEntryType,
  LeaveTypeCode,
} from '@prisma/client';
import { LeaveService } from './leave.service';

describe('LeaveService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  let prisma: any;
  let service: LeaveService;

  beforeEach(() => {
    prisma = {
      leaveType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leavePolicy: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      leaveBalance: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      leaveLedgerEntry: {
        create: jest.fn(),
      },
      leaveApplication: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      leaveApprovalStep: {
        create: jest.fn(),
      },
      holidayCalendar: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      publicHoliday: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      leaveEncashment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
      },
    };
    jest.clearAllMocks();
    service = new LeaveService(prisma, audit as any);
    jest
      .spyOn(service as any, 'ensureDefaultSetup')
      .mockResolvedValue(undefined);
  });

  it('skips weekends and enabled public or mercantile holidays', async () => {
    prisma.publicHoliday.findMany.mockResolvedValue([
      { date: new Date('2026-05-01T00:00:00.000Z') },
    ]);

    const days = await service.calculateLeaveDays(
      'company-1',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-04T00:00:00.000Z'),
      LeaveDayPart.FULL_DAY,
    );

    expect(days).toBe(1);
  });

  it('blocks annual leave before the one-year vesting anniversary', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'annual-1',
      code: LeaveTypeCode.ANNUAL,
      name: 'Annual Leave',
      requiresBalance: true,
    });
    prisma.publicHoliday.findMany.mockResolvedValue([]);
    prisma.leaveApplication.findFirst.mockResolvedValue(null);
    prisma.leavePolicy.findFirst.mockResolvedValue({
      entitlementDays: 14,
      vestingMonths: 12,
    });
    prisma.leaveBalance.upsert.mockResolvedValue({
      id: 'balance-1',
      accrued: 0,
      available: 0,
    });

    await expect(
      service.createApplication('company-1', 'user-1', {
        employeeId: 'employee-1',
        leaveTypeCode: LeaveTypeCode.ANNUAL,
        startDate: '2026-05-04',
        endDate: '2026-05-04',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows no-pay leave without requiring a positive balance', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      joinedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'nopay-1',
      code: LeaveTypeCode.NO_PAY,
      name: 'No-pay Leave',
      requiresBalance: false,
    });
    prisma.publicHoliday.findMany.mockResolvedValue([]);
    prisma.leaveApplication.findFirst.mockResolvedValue(null);
    prisma.leaveApplication.create.mockResolvedValue({ id: 'application-1' });

    await service.createApplication('company-1', 'user-1', {
      employeeId: 'employee-1',
      leaveTypeCode: LeaveTypeCode.NO_PAY,
      startDate: '2026-05-04',
      endDate: '2026-05-04',
    });

    expect(prisma.leaveBalance.upsert).not.toHaveBeenCalled();
    expect(prisma.leaveApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestedDays: 1,
        }),
      }),
    );
  });

  it('approves leave and writes a balance ledger deduction', async () => {
    prisma.leaveApplication.findFirst.mockResolvedValue({
      id: 'application-1',
      companyId: 'company-1',
      employeeId: 'employee-1',
      leaveTypeId: 'annual-1',
      requestedDays: 2,
      status: LeaveApplicationStatus.PENDING,
      startDate: new Date('2026-05-04T00:00:00.000Z'),
      leaveType: {
        id: 'annual-1',
        name: 'Annual Leave',
        requiresBalance: true,
      },
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      joinedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.leavePolicy.findFirst.mockResolvedValue({
      entitlementDays: 14,
      vestingMonths: 12,
    });
    prisma.leaveBalance.upsert.mockResolvedValue({
      id: 'balance-1',
      accrued: 14,
      available: 14,
    });
    prisma.leaveLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prisma.leaveBalance.update.mockResolvedValue({});
    prisma.leaveApplication.update.mockResolvedValue({ id: 'application-1' });
    prisma.leaveApprovalStep.create.mockResolvedValue({});

    await service.approveApplication('company-1', 'manager-1', 'application-1', {
      notes: 'Approved',
    });

    expect(prisma.leaveLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: LeaveLedgerEntryType.APPLICATION_APPROVED,
          quantity: -2,
        }),
      }),
    );
  });

  it('creates capped carry-forward ledger entries', async () => {
    jest
      .spyOn(service as any, 'ensureDefaultSetup')
      .mockResolvedValue(undefined);
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'annual-1',
      code: LeaveTypeCode.ANNUAL,
    });
    prisma.leavePolicy.findFirst.mockResolvedValue({
      carryForwardEnabled: true,
      carryForwardCapDays: 7,
      carryForwardExpiryMonth: 3,
      carryForwardExpiryDay: 31,
      entitlementDays: 14,
      vestingMonths: 12,
    });
    prisma.leaveBalance.findMany.mockResolvedValue([
      {
        id: 'source-balance',
        employeeId: 'employee-1',
        available: 10,
      },
    ]);
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      joinedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.leaveBalance.upsert.mockResolvedValue({
      id: 'target-balance',
      accrued: 14,
      available: 14,
    });
    prisma.leaveLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prisma.leaveBalance.update.mockResolvedValue({});

    const result = await service.carryForward('company-1', 'hr-1', {
      fromYear: 2025,
      toYear: 2026,
    });

    expect(result).toEqual({ carriedForward: 1 });
    expect(prisma.leaveLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: LeaveLedgerEntryType.CARRY_FORWARD,
          quantity: 7,
        }),
      }),
    );
  });

  it('approves encashment and reduces available balance', async () => {
    prisma.leaveEncashment.findFirst.mockResolvedValue({
      id: 'encashment-1',
      employeeId: 'employee-1',
      leaveTypeId: 'annual-1',
      status: 'PENDING',
      days: 2,
      amount: null,
      employee: { salaryProfile: { basicSalary: 300000 } },
    });
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      joinedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    prisma.leavePolicy.findFirst.mockResolvedValue({
      entitlementDays: 14,
      vestingMonths: 12,
    });
    prisma.leaveBalance.upsert.mockResolvedValue({
      id: 'balance-1',
      accrued: 14,
      available: 14,
    });
    prisma.leaveLedgerEntry.create.mockResolvedValue({ id: 'ledger-1' });
    prisma.leaveBalance.update.mockResolvedValue({});
    prisma.leaveEncashment.update.mockResolvedValue({ id: 'encashment-1' });

    await service.approveEncashment('company-1', 'hr-1', 'encashment-1');

    expect(prisma.leaveLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: LeaveLedgerEntryType.ENCASHMENT,
          quantity: -2,
        }),
      }),
    );
    expect(prisma.leaveEncashment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 20000 }),
      }),
    );
  });
});
