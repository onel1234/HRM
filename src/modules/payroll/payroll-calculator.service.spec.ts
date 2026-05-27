jest.mock('@prisma/client', () => ({
  OvertimeMultiplier: {
    ONE_POINT_FIVE: 'ONE_POINT_FIVE',
    TWO_POINT_ZERO: 'TWO_POINT_ZERO',
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
  TaxDeclarationType: {
    PRIMARY: 'PRIMARY',
    SECONDARY: 'SECONDARY',
    EXEMPT: 'EXEMPT',
    NON_RESIDENT: 'NON_RESIDENT',
  },
}));

import {
  OvertimeMultiplier,
  SalaryComponentType,
  TaxDeclarationType,
} from '@prisma/client';
import {
  ComplianceRuleValue,
  PayrollCalculatorService,
  SalaryProfileInput,
} from './payroll-calculator.service';

describe('PayrollCalculatorService', () => {
  const service = new PayrollCalculatorService();
  const rules: ComplianceRuleValue[] = [
    { code: 'EPF_EMPLOYEE_RATE', value: { rate: 0.08 } },
    { code: 'EPF_EMPLOYER_RATE', value: { rate: 0.12 } },
    { code: 'ETF_EMPLOYER_RATE', value: { rate: 0.03 } },
    { code: 'MINIMUM_WAGE', value: { monthly: 30000 } },
    {
      code: 'APIT_2025_26_TABLE_01',
      value: {
        brackets: [
          { min: 0, max: 150000, rate: 0, subtract: 0 },
          { min: 150001, max: 233333, rate: 0.06, subtract: 9000 },
          { min: 233334, max: 275000, rate: 0.18, subtract: 37000 },
          { min: 275001, max: 316667, rate: 0.24, subtract: 53500 },
          { min: 316668, max: 358333, rate: 0.3, subtract: 72500 },
          { min: 358334, max: null, rate: 0.36, subtract: 94000 },
        ],
      },
    },
  ];

  function profile(
    overrides: Partial<SalaryProfileInput> = {},
  ): SalaryProfileInput {
    return {
      employeeId: 'employee-1',
      employeeName: 'Nimali Perera',
      joinedAt: new Date('2018-01-01'),
      basicSalary: 300000,
      standardHoursPerMonth: 240,
      taxDeclarationType: TaxDeclarationType.PRIMARY,
      isPrimaryEmployment: true,
      epfEnabled: true,
      etfEnabled: true,
      apitEnabled: true,
      establishmentEmployeeCount: 20,
      components: [],
      ...overrides,
    };
  }

  it('calculates APIT using the 2025/26 primary employment brackets', () => {
    const result = service.calculate(
      profile(),
      { year: 2026, month: 1 },
      rules,
    );

    expect(result.apit).toBe(18500);
    expect(result.netPay).toBe(257500);
  });

  it('calculates EPF employee, EPF employer, and ETF employer contributions', () => {
    const result = service.calculate(
      profile(),
      { year: 2026, month: 1 },
      rules,
    );

    expect(result.epfEmployee).toBe(24000);
    expect(result.epfEmployer).toBe(36000);
    expect(result.etfEmployer).toBe(9000);
    expect(result.employerContributions).toBe(45000);
  });

  it('supports overtime multipliers from salary components', () => {
    const result = service.calculate(
      profile({
        basicSalary: 240000,
        components: [
          {
            code: 'OT15',
            name: 'Overtime 1.5x',
            type: SalaryComponentType.OVERTIME,
            amount: 0,
            quantity: 10,
            overtimeMultiplier: OvertimeMultiplier.ONE_POINT_FIVE,
            taxable: true,
            epfEligible: false,
            etfEligible: false,
            apitEligible: true,
          },
          {
            code: 'OT20',
            name: 'Overtime 2x',
            type: SalaryComponentType.OVERTIME,
            amount: 0,
            quantity: 5,
            overtimeMultiplier: OvertimeMultiplier.TWO_POINT_ZERO,
            taxable: true,
            epfEligible: false,
            etfEligible: false,
            apitEligible: true,
          },
        ],
      }),
      { year: 2026, month: 1 },
      rules,
    );

    expect(result.grossEarnings).toBe(265000);
    expect(result.lines.find((line) => line.code === 'OT15')?.amount).toBe(
      15000,
    );
    expect(result.lines.find((line) => line.code === 'OT20')?.amount).toBe(
      10000,
    );
  });

  it('warns when the basic salary is below the effective minimum wage', () => {
    const result = service.calculate(
      profile({ basicSalary: 25000 }),
      { year: 2026, month: 1 },
      rules,
    );

    expect(result.validationWarnings[0]).toContain('below minimum wage');
  });

  it('tracks gratuity eligibility after five completed years', () => {
    const result = service.calculate(
      profile(),
      { year: 2026, month: 1 },
      rules,
    );

    expect(result.gratuityEligible).toBe(true);
    expect(result.completedYears).toBe(8);
    expect(result.gratuityAccrual).toBe(1200000);
  });
});
