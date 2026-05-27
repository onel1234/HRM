/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  AttendanceRecordStatus: {
    APPROVED: 'APPROVED',
  },
  LeaveApplicationStatus: {
    APPROVED: 'APPROVED',
  },
  LeaveEncashmentStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PAID: 'PAID',
  },
  LeaveTypeCode: {
    ANNUAL: 'ANNUAL',
    CASUAL: 'CASUAL',
    SICK: 'SICK',
    MATERNITY: 'MATERNITY',
    PATERNITY: 'PATERNITY',
    NO_PAY: 'NO_PAY',
  },
  OvertimeMultiplier: {
    ONE_POINT_FIVE: 'ONE_POINT_FIVE',
    TWO_POINT_ZERO: 'TWO_POINT_ZERO',
  },
  PayRunStatus: {
    DRAFT: 'DRAFT',
    CALCULATED: 'CALCULATED',
    APPROVED: 'APPROVED',
    FINALIZED: 'FINALIZED',
    CANCELLED: 'CANCELLED',
  },
  PayrollExportType: {
    EPF_R1: 'EPF_R1',
    EPF_R4: 'EPF_R4',
    BANK_PAYMENT: 'BANK_PAYMENT',
    APIT_RAMIS: 'APIT_RAMIS',
    T10: 'T10',
  },
  PayrollLineItemType: {
    EARNING: 'EARNING',
    DEDUCTION: 'DEDUCTION',
    TAX: 'TAX',
    EMPLOYER_CONTRIBUTION: 'EMPLOYER_CONTRIBUTION',
    ACCRUAL: 'ACCRUAL',
  },
  SalaryComponentType: {
    BASIC: 'BASIC',
    ALLOWANCE: 'ALLOWANCE',
    DEDUCTION: 'DEDUCTION',
    OVERTIME: 'OVERTIME',
    BONUS: 'BONUS',
    NON_CASH_BENEFIT: 'NON_CASH_BENEFIT',
    EMPLOYER_CONTRIBUTION: 'EMPLOYER_CONTRIBUTION',
    TAX: 'TAX',
  },
  StatutoryFilingStatus: {
    GENERATED: 'GENERATED',
    SUBMITTED: 'SUBMITTED',
    FAILED: 'FAILED',
  },
  TaxDeclarationType: {
    PRIMARY: 'PRIMARY',
    SECONDARY: 'SECONDARY',
    EXEMPT: 'EXEMPT',
    NON_RESIDENT: 'NON_RESIDENT',
  },
}));

import {
  AttendanceRecordStatus,
  LeaveApplicationStatus,
  LeaveEncashmentStatus,
  LeaveTypeCode,
  OvertimeMultiplier,
  SalaryComponentType,
  TaxDeclarationType,
} from '@prisma/client';
import { PayrollService } from './payroll.service';

describe('PayrollService attendance overtime integration', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const calculator = { calculate: jest.fn() };
  const pdf = { createPayslip: jest.fn() };
  const notifications = { add: jest.fn() };
  let prisma: any;
  let service: PayrollService;

  beforeEach(() => {
    prisma = {
      attendanceRecord: {
        findMany: jest.fn().mockResolvedValue([
          { employeeId: 'employee-1', overtimeHours: 2.5 },
          { employeeId: 'employee-1', overtimeHours: 1.5 },
          { employeeId: 'employee-2', overtimeHours: 3 },
        ]),
      },
      attendancePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          overtimeMultiplier: OvertimeMultiplier.TWO_POINT_ZERO,
        }),
      },
      salaryComponent: {
        findFirst: jest.fn(),
      },
      leaveApplication: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      leaveEncashment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new PayrollService(
      prisma,
      audit as any,
      calculator as any,
      pdf as any,
      notifications as any,
    );
  });

  it('loads only approved attendance overtime for the pay-run period', async () => {
    const result = await (service as any).getAttendanceOvertimeForPayRun(
      'company-1',
      2026,
      5,
      ['employee-1', 'employee-2'],
    );

    expect(prisma.attendanceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          employeeId: { in: ['employee-1', 'employee-2'] },
          status: AttendanceRecordStatus.APPROVED,
          overtimeHours: { gt: 0 },
        }),
      }),
    );
    expect(result.hoursByEmployee.get('employee-1')).toBe(4);
    expect(result.hoursByEmployee.get('employee-2')).toBe(3);
    expect(result.multiplier).toBe(OvertimeMultiplier.TWO_POINT_ZERO);
  });

  it('adds attendance overtime as an existing OT component input', () => {
    const input = (service as any).toCalculationInput(
      {
        employeeId: 'employee-1',
        employee: {
          firstName: 'Nimali',
          lastName: 'Perera',
          joinedAt: new Date('2020-01-01'),
        },
        basicSalary: 240000,
        standardHoursPerMonth: 240,
        overtimeEnabled: true,
        taxDeclarationType: TaxDeclarationType.PRIMARY,
        isPrimaryEmployment: true,
        epfEnabled: true,
        etfEnabled: true,
        apitEnabled: true,
        establishmentEmployeeCount: 20,
        components: [],
      },
      4,
      OvertimeMultiplier.ONE_POINT_FIVE,
      {
        id: 'component-ot15',
        code: 'OT15',
        name: 'Overtime 1.5x',
        taxable: true,
        epfEligible: false,
        etfEligible: false,
        apitEligible: true,
      },
    );

    expect(input.components).toContainEqual(
      expect.objectContaining({
        id: 'component-ot15',
        code: 'OT15',
        type: SalaryComponentType.OVERTIME,
        quantity: 4,
        overtimeMultiplier: OvertimeMultiplier.ONE_POINT_FIVE,
      }),
    );
  });

  it('loads approved no-pay and encashment adjustments for payroll', async () => {
    prisma.leaveApplication.findMany.mockResolvedValue([
      { employeeId: 'employee-1', requestedDays: 2 },
    ]);
    prisma.leaveEncashment.findMany.mockResolvedValue([
      { employeeId: 'employee-1', days: 1.5, amount: 15000 },
    ]);

    const result = await (service as any).getLeavePayrollAdjustments(
      'company-1',
      2026,
      5,
      ['employee-1'],
    );

    expect(prisma.leaveApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: LeaveApplicationStatus.APPROVED,
          leaveType: { code: LeaveTypeCode.NO_PAY },
        }),
      }),
    );
    expect(prisma.leaveEncashment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: LeaveEncashmentStatus.APPROVED,
        }),
      }),
    );
    expect(result.get('employee-1')).toEqual({
      noPayDays: 2,
      encashmentDays: 1.5,
      encashmentAmount: 15000,
    });
  });

  it('adds no-pay deductions and leave encashment earnings to calculator input', () => {
    const input = (service as any).toCalculationInput(
      {
        employeeId: 'employee-1',
        employee: {
          firstName: 'Nimali',
          lastName: 'Perera',
          joinedAt: new Date('2020-01-01'),
        },
        basicSalary: 300000,
        standardHoursPerMonth: 240,
        overtimeEnabled: true,
        taxDeclarationType: TaxDeclarationType.PRIMARY,
        isPrimaryEmployment: true,
        epfEnabled: true,
        etfEnabled: true,
        apitEnabled: true,
        establishmentEmployeeCount: 20,
        components: [],
      },
      0,
      OvertimeMultiplier.ONE_POINT_FIVE,
      null,
      { noPayDays: 2, encashmentDays: 1, encashmentAmount: 12000 },
    );

    expect(input.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNPAID_LEAVE',
          type: SalaryComponentType.DEDUCTION,
          amount: 20000,
        }),
        expect.objectContaining({
          code: 'LEAVE_ENCASH',
          type: SalaryComponentType.BONUS,
          amount: 12000,
        }),
      ]),
    );
  });
});
