import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OvertimeMultiplier,
  PayrollPaymentMethod,
  SalaryComponentType,
  TaxDeclarationType,
} from '@prisma/client';

export class CreateSalaryComponentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ enum: SalaryComponentType })
  @IsEnum(SalaryComponentType)
  type: SalaryComponentType;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  epfEligible?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  etfEligible?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  apitEligible?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  visibleOnPayslip?: boolean;
}

export class UpdateSalaryComponentDto extends PartialType(
  CreateSalaryComponentDto,
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class EmployeeSalaryComponentDto {
  @ApiProperty()
  @IsString()
  componentId: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiProperty({ enum: OvertimeMultiplier, required: false })
  @IsEnum(OvertimeMultiplier)
  @IsOptional()
  overtimeMultiplier?: OvertimeMultiplier;
}

export class UpsertSalaryProfileDto {
  @ApiProperty()
  @IsNumber()
  basicSalary: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  standardHoursPerMonth?: number;

  @ApiProperty({ enum: PayrollPaymentMethod, required: false })
  @IsEnum(PayrollPaymentMethod)
  @IsOptional()
  paymentMethod?: PayrollPaymentMethod;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankBranchCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankAccountName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  epfNumber?: string;

  @ApiProperty({ enum: TaxDeclarationType, required: false })
  @IsEnum(TaxDeclarationType)
  @IsOptional()
  taxDeclarationType?: TaxDeclarationType;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isPrimaryEmployment?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  epfEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  etfEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  apitEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  overtimeEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  establishmentEmployeeCount?: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @ApiProperty({ type: [EmployeeSalaryComponentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmployeeSalaryComponentDto)
  @IsOptional()
  components?: EmployeeSalaryComponentDto[];
}

export class CreatePayRunDto {
  @ApiProperty()
  @IsInt()
  @Min(2000)
  periodYear: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  employeeIds?: string[];
}

export class PayRunIdDto {
  @ApiProperty()
  @IsString()
  payRunId: string;
}

export class ExportBankDto extends PayRunIdDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  formatId?: string;
}

export class EmailPayslipsDto extends PayRunIdDto {
  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  employeeIds?: string[];
}

export class UpdateComplianceRuleDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @ApiProperty()
  @IsObject()
  value: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sourceUrl?: string;
}

export class CreateBankExportFormatDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  delimiter?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  includeHeader?: boolean;

  @ApiProperty()
  @IsArray()
  fields: Array<{ label: string; source: string }>;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  constants?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateBankExportFormatDto extends PartialType(
  CreateBankExportFormatDto,
) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class GenerateT10Dto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;
}
