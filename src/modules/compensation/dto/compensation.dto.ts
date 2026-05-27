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
} from 'class-validator';
import {
  AllowanceStatus,
  AllowanceType,
  BenefitEnrollmentStatus,
  BenefitPlanType,
  CompensationItemStatus,
  CompensationPlanStatus,
  VariablePayStatus,
  VariablePayType,
} from '@prisma/client';

export class CreateCompensationGradeDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateCompensationGradeDto extends PartialType(
  CreateCompensationGradeDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateCompensationBandDto {
  @ApiProperty()
  @IsString()
  gradeId: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  minSalary: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  midpoint?: number;

  @ApiProperty()
  @IsNumber()
  maxSalary: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCompensationBandDto extends PartialType(
  CreateCompensationBandDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignCompensationBandDto {
  @ApiProperty()
  @IsString()
  gradeId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bandId?: string;
}

export class CreateAnnualIncrementPlanDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  fiscalYear: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetAmount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  budgetPercent?: number;

  @ApiProperty()
  @IsDateString()
  plannedEffectiveDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAnnualIncrementPlanDto extends PartialType(
  CreateAnnualIncrementPlanDto,
) {
  @ApiProperty({ enum: CompensationPlanStatus, required: false })
  @IsEnum(CompensationPlanStatus)
  @IsOptional()
  status?: CompensationPlanStatus;
}

export class AddIncrementPlanEmployeesDto {
  @ApiProperty({ type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  employeeIds?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultPercent?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultAmount?: number;
}

export class UpsertIncrementPlanItemDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedPercent?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedAmount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  approvedPercent?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  approvedAmount?: number;

  @ApiProperty({ enum: CompensationItemStatus, required: false })
  @IsEnum(CompensationItemStatus)
  @IsOptional()
  status?: CompensationItemStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rationale?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;
}

export class CreateVariablePayAwardDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  salaryComponentId?: string;

  @ApiProperty({ enum: VariablePayType })
  @IsEnum(VariablePayType)
  type: VariablePayType;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  periodYear: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  periodMonth?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  performancePeriod?: string;
}

export class UpdateVariablePayAwardDto extends PartialType(
  CreateVariablePayAwardDto,
) {
  @ApiProperty({ enum: VariablePayStatus, required: false })
  @IsEnum(VariablePayStatus)
  @IsOptional()
  status?: VariablePayStatus;
}

export class UpsertAllowanceRecordDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ enum: AllowanceType })
  @IsEnum(AllowanceType)
  type: AllowanceType;

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
  @IsNumber()
  @Min(0)
  @IsOptional()
  entitlement?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  claimedAmount?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  approvedAmount?: number;

  @ApiProperty({ enum: AllowanceStatus, required: false })
  @IsEnum(AllowanceStatus)
  @IsOptional()
  status?: AllowanceStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  receiptRequired?: boolean;
}

export class CreateBenefitPlanDto {
  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: BenefitPlanType })
  @IsEnum(BenefitPlanType)
  type: BenefitPlanType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  employeeContribution?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  employerContribution?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  coverageAmount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  enrolmentWindowStart?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  enrolmentWindowEnd?: string;
}

export class UpdateBenefitPlanDto extends PartialType(CreateBenefitPlanDto) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class EnrollBenefitDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty()
  @IsString()
  planId: string;

  @ApiProperty()
  @IsDateString()
  coverageStart: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  coverageEnd?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  dependents?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class DecideBenefitEnrollmentDto {
  @ApiProperty({ enum: BenefitEnrollmentStatus })
  @IsEnum(BenefitEnrollmentStatus)
  status: BenefitEnrollmentStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CompensationStatementQueryDto {
  @ApiProperty({ required: false })
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @IsOptional()
  periodYear?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  @IsOptional()
  periodMonth?: number;
}
