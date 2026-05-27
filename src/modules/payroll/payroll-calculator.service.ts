import { Injectable } from '@nestjs/common';
import {
  OvertimeMultiplier,
  PayrollLineItemType,
  SalaryComponentType,
  TaxDeclarationType,
} from '@prisma/client';

export interface ComplianceRuleValue {
  code: string;
  value: Record<string, unknown>;
}

export interface ComponentInput {
  id?: string;
  code: string;
  name: string;
  type: SalaryComponentType;
  amount: number;
  quantity?: number;
  overtimeMultiplier?: OvertimeMultiplier | null;
  taxable: boolean;
  epfEligible: boolean;
  etfEligible: boolean;
  apitEligible: boolean;
}

export interface SalaryProfileInput {
  employeeId: string;
  employeeName: string;
  joinedAt: Date;
  basicSalary: number;
  standardHoursPerMonth: number;
  overtimeEnabled?: boolean;
  taxDeclarationType: TaxDeclarationType;
  isPrimaryEmployment: boolean;
  epfEnabled: boolean;
  etfEnabled: boolean;
  apitEnabled: boolean;
  establishmentEmployeeCount?: number | null;
  components: ComponentInput[];
}

export interface CalculatedPayrollLine {
  componentId?: string;
  type: PayrollLineItemType;
  code: string;
  name: string;
  amount: number;
  quantity?: number;
  rate?: number;
  taxable: boolean;
  epfEligible: boolean;
  etfEligible: boolean;
  apitEligible: boolean;
  metadata?: Record<string, unknown>;
}

export interface PayrollCalculationResult {
  grossEarnings: number;
  taxableEarnings: number;
  epfEligibleEarnings: number;
  etfEligibleEarnings: number;
  employeeDeductions: number;
  employerContributions: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  apit: number;
  netPay: number;
  gratuityAccrual: number;
  serviceYears: number;
  completedYears: number;
  gratuityEligible: boolean;
  validationWarnings: string[];
  lines: CalculatedPayrollLine[];
}

@Injectable()
export class PayrollCalculatorService {
  calculate(
    profile: SalaryProfileInput,
    period: { year: number; month: number },
    rules: ComplianceRuleValue[],
  ): PayrollCalculationResult {
    const lines: CalculatedPayrollLine[] = [];
    const warnings: string[] = [];
    const basicSalary = this.money(profile.basicSalary);

    const minimumWage = this.getMinimumMonthlyWage(rules);
    if (basicSalary < minimumWage) {
      warnings.push(
        `Basic salary LKR ${basicSalary.toFixed(2)} is below minimum wage LKR ${minimumWage.toFixed(2)}.`,
      );
    }

    lines.push({
      type: PayrollLineItemType.EARNING,
      code: 'BASIC',
      name: 'Basic Salary',
      amount: basicSalary,
      taxable: true,
      epfEligible: true,
      etfEligible: true,
      apitEligible: true,
    });

    for (const component of profile.components) {
      if (
        component.type === SalaryComponentType.OVERTIME &&
        profile.overtimeEnabled === false
      ) {
        continue;
      }
      const line = this.calculateComponent(component, profile);
      if (line) lines.push(line);
    }

    const grossEarnings = this.sum(
      lines.filter((line) => line.type === PayrollLineItemType.EARNING),
    );
    const salaryDeductions = this.sum(
      lines.filter((line) => line.type === PayrollLineItemType.DEDUCTION),
    );
    const taxableEarnings = this.sum(
      lines.filter(
        (line) => line.taxable && line.type === PayrollLineItemType.EARNING,
      ),
    );
    const epfEligibleEarnings = profile.epfEnabled
      ? this.sum(
          lines.filter(
            (line) =>
              line.epfEligible && line.type === PayrollLineItemType.EARNING,
          ),
        )
      : 0;
    const etfEligibleEarnings = profile.etfEnabled
      ? this.sum(
          lines.filter(
            (line) =>
              line.etfEligible && line.type === PayrollLineItemType.EARNING,
          ),
        )
      : 0;

    const epfEmployee = profile.epfEnabled
      ? this.money(
          epfEligibleEarnings * this.getRate(rules, 'EPF_EMPLOYEE_RATE', 0.08),
        )
      : 0;
    const epfEmployer = profile.epfEnabled
      ? this.money(
          epfEligibleEarnings * this.getRate(rules, 'EPF_EMPLOYER_RATE', 0.12),
        )
      : 0;
    const etfEmployer = profile.etfEnabled
      ? this.money(
          etfEligibleEarnings * this.getRate(rules, 'ETF_EMPLOYER_RATE', 0.03),
        )
      : 0;
    const apit = profile.apitEnabled
      ? this.calculateApit(profile, taxableEarnings, rules, warnings)
      : 0;

    if (epfEmployee > 0) {
      lines.push(
        this.statutoryLine('EPF_EMPLOYEE', 'EPF Employee 8%', epfEmployee),
      );
    }
    if (apit > 0) {
      lines.push(this.statutoryLine('APIT', 'APIT', apit));
    }
    if (epfEmployer > 0) {
      lines.push(
        this.employerLine('EPF_EMPLOYER', 'EPF Employer 12%', epfEmployer),
      );
    }
    if (etfEmployer > 0) {
      lines.push(
        this.employerLine('ETF_EMPLOYER', 'ETF Employer 3%', etfEmployer),
      );
    }

    const service = this.calculateService(profile.joinedAt, period);
    const establishmentCount = profile.establishmentEmployeeCount;
    const gratuityEligible =
      service.completedYears >= 5 &&
      (establishmentCount == null || establishmentCount >= 15);
    const gratuityAccrual = gratuityEligible
      ? this.money(0.5 * basicSalary * service.completedYears)
      : 0;
    if (service.completedYears < 5 && service.serviceYears >= 4.5) {
      warnings.push('Employee is approaching the 5-year gratuity threshold.');
    }
    if (establishmentCount != null && establishmentCount < 15) {
      warnings.push(
        'Gratuity Act establishment threshold is below 15 employees.',
      );
    }
    if (gratuityAccrual > 0) {
      lines.push({
        type: PayrollLineItemType.ACCRUAL,
        code: 'GRATUITY_ACCRUAL',
        name: 'Gratuity Accrual',
        amount: gratuityAccrual,
        taxable: false,
        epfEligible: false,
        etfEligible: false,
        apitEligible: false,
      });
    }

    const employeeDeductions = this.money(
      salaryDeductions + epfEmployee + apit,
    );
    const employerContributions = this.money(epfEmployer + etfEmployer);
    const netPay = this.money(grossEarnings - employeeDeductions);

    return {
      grossEarnings,
      taxableEarnings,
      epfEligibleEarnings,
      etfEligibleEarnings,
      employeeDeductions,
      employerContributions,
      epfEmployee,
      epfEmployer,
      etfEmployer,
      apit,
      netPay,
      gratuityAccrual,
      serviceYears: service.serviceYears,
      completedYears: service.completedYears,
      gratuityEligible,
      validationWarnings: warnings,
      lines,
    };
  }

  private calculateComponent(
    component: ComponentInput,
    profile: SalaryProfileInput,
  ): CalculatedPayrollLine | null {
    if (component.type === SalaryComponentType.BASIC) return null;
    if (component.type === SalaryComponentType.EMPLOYER_CONTRIBUTION)
      return null;
    if (component.type === SalaryComponentType.TAX) return null;

    if (component.type === SalaryComponentType.OVERTIME) {
      const quantity = component.quantity || 0;
      const multiplier =
        component.overtimeMultiplier === OvertimeMultiplier.TWO_POINT_ZERO
          ? 2
          : 1.5;
      const baseRate =
        component.amount > 0
          ? component.amount
          : profile.basicSalary / profile.standardHoursPerMonth;
      return {
        componentId: component.id,
        type: PayrollLineItemType.EARNING,
        code: component.code,
        name: component.name,
        amount: this.money(baseRate * quantity * multiplier),
        quantity,
        rate: this.money(baseRate * multiplier),
        taxable: component.taxable,
        epfEligible: component.epfEligible,
        etfEligible: component.etfEligible,
        apitEligible: component.apitEligible,
        metadata: { multiplier },
      };
    }

    return {
      componentId: component.id,
      type:
        component.type === SalaryComponentType.DEDUCTION
          ? PayrollLineItemType.DEDUCTION
          : PayrollLineItemType.EARNING,
      code: component.code,
      name: component.name,
      amount: this.money(component.amount * (component.quantity || 1)),
      quantity: component.quantity || 1,
      taxable: component.taxable,
      epfEligible: component.epfEligible,
      etfEligible: component.etfEligible,
      apitEligible: component.apitEligible,
    };
  }

  private calculateApit(
    profile: SalaryProfileInput,
    taxableEarnings: number,
    rules: ComplianceRuleValue[],
    warnings: string[],
  ) {
    if (
      profile.taxDeclarationType === TaxDeclarationType.EXEMPT ||
      profile.taxDeclarationType === TaxDeclarationType.NON_RESIDENT
    ) {
      warnings.push('APIT was skipped due to employee tax declaration type.');
      return 0;
    }
    if (
      !profile.isPrimaryEmployment ||
      profile.taxDeclarationType === TaxDeclarationType.SECONDARY
    ) {
      warnings.push('Secondary employment APIT table is not automated in v1.');
      return 0;
    }

    const table = rules.find(
      (rule) => rule.code === 'APIT_2025_26_TABLE_01',
    )?.value;
    const brackets = Array.isArray(table?.brackets) ? table.brackets : [];
    const bracket = brackets.find((candidate) => {
      const row = candidate as { min?: number; max?: number | null };
      return (
        taxableEarnings >= (row.min || 0) &&
        (row.max == null || taxableEarnings <= row.max)
      );
    }) as { rate?: number; subtract?: number } | undefined;

    if (!bracket) return 0;
    return this.money(
      Math.max(
        0,
        taxableEarnings * (bracket.rate || 0) - (bracket.subtract || 0),
      ),
    );
  }

  private getMinimumMonthlyWage(rules: ComplianceRuleValue[]) {
    const rule = rules.find((candidate) => candidate.code === 'MINIMUM_WAGE');
    const monthly = rule?.value.monthly;
    return typeof monthly === 'number' ? monthly : 30000;
  }

  private getRate(
    rules: ComplianceRuleValue[],
    code: string,
    fallback: number,
  ) {
    const value = rules.find((rule) => rule.code === code)?.value.rate;
    return typeof value === 'number' ? value : fallback;
  }

  private calculateService(
    joinedAt: Date,
    period: { year: number; month: number },
  ) {
    const periodEnd = new Date(period.year, period.month, 0);
    const days =
      Math.max(0, periodEnd.getTime() - joinedAt.getTime()) / 86400000;
    const serviceYears = this.money(days / 365.25);
    return { serviceYears, completedYears: Math.floor(serviceYears) };
  }

  private statutoryLine(
    code: string,
    name: string,
    amount: number,
  ): CalculatedPayrollLine {
    return {
      type:
        code === 'APIT'
          ? PayrollLineItemType.TAX
          : PayrollLineItemType.DEDUCTION,
      code,
      name,
      amount,
      taxable: false,
      epfEligible: false,
      etfEligible: false,
      apitEligible: false,
    };
  }

  private employerLine(
    code: string,
    name: string,
    amount: number,
  ): CalculatedPayrollLine {
    return {
      type: PayrollLineItemType.EMPLOYER_CONTRIBUTION,
      code,
      name,
      amount,
      taxable: false,
      epfEligible: false,
      etfEligible: false,
      apitEligible: false,
    };
  }

  private sum(lines: CalculatedPayrollLine[]) {
    return this.money(lines.reduce((total, line) => total + line.amount, 0));
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}
