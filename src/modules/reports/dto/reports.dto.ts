import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PayrollExportType } from '@prisma/client';

export enum ReportExportFormat {
  JSON = 'json',
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf',
}

export enum ReportType {
  HEADCOUNT = 'headcount',
  TURNOVER = 'turnover',
  LEAVE = 'leave',
  PAYROLL_SUMMARY = 'payroll_summary',
  PAYROLL_COST = 'payroll_cost',
  LABOUR_STATUTORY = 'labour_statutory',
  AUDIT_LOG = 'audit_log',
  CUSTOM = 'custom',
}

export enum CustomReportEntity {
  EMPLOYEES = 'employees',
  PAYROLL = 'payroll',
  LEAVE = 'leave',
  AUDIT = 'audit',
}

export class ReportQueryDto {
  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(2000)
  @IsOptional()
  year?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @ApiProperty({ enum: ReportExportFormat, required: false })
  @IsEnum(ReportExportFormat)
  @IsOptional()
  format?: ReportExportFormat;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  companyId?: string;
}

export class AuditLogQueryDto extends ReportQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class StatutoryFilingQueryDto extends ReportQueryDto {
  @ApiProperty({ enum: PayrollExportType, required: false })
  @IsEnum(PayrollExportType)
  @IsOptional()
  type?: PayrollExportType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payRunId?: string;
}

export class CustomReportDto {
  @ApiProperty({ enum: CustomReportEntity })
  @IsEnum(CustomReportEntity)
  entity: CustomReportEntity;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  fields: string[];

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @ApiProperty({ enum: ReportExportFormat, required: false })
  @IsEnum(ReportExportFormat)
  @IsOptional()
  format?: ReportExportFormat;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;
}

export class ScheduleReportEmailDto {
  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({ enum: ReportExportFormat, required: false })
  @IsEnum(ReportExportFormat)
  @IsOptional()
  format?: ReportExportFormat;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsEmail({}, { each: true })
  to: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ required: false, description: 'Bull cron expression' })
  @IsString()
  @IsOptional()
  cron?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  filters?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @Type(() => CustomReportDto)
  @IsOptional()
  customReport?: CustomReportDto;
}
