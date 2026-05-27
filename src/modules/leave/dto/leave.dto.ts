import { ApiProperty, PartialType } from '@nestjs/swagger';
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
  HolidayCategory,
  LeaveDayPart,
  LeaveTypeCode,
} from '@prisma/client';

export class CreateLeaveTypeDto {
  @ApiProperty({ enum: LeaveTypeCode })
  @IsEnum(LeaveTypeCode)
  code: LeaveTypeCode;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  paid?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  requiresBalance?: boolean;
}

export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateLeavePolicyDto {
  @ApiProperty()
  @IsString()
  leaveTypeId: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  entitlementDays?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  vestingMonths?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  carryForwardEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  carryForwardCapDays?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  carryForwardExpiryMonth?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  carryForwardExpiryDay?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  encashmentEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  payrollComponentCode?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ApplyLeaveDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  leaveTypeId?: string;

  @ApiProperty({ enum: LeaveTypeCode, required: false })
  @IsEnum(LeaveTypeCode)
  @IsOptional()
  leaveTypeCode?: LeaveTypeCode;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ enum: LeaveDayPart, required: false })
  @IsEnum(LeaveDayPart)
  @IsOptional()
  dayPart?: LeaveDayPart;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateLeaveApplicationDto extends ApplyLeaveDto {
  @ApiProperty()
  @IsString()
  employeeId: string;
}

export class DecideLeaveApplicationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpsertHolidayDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: HolidayCategory, isArray: true })
  @IsArray()
  @IsEnum(HolidayCategory, { each: true })
  categories: HolidayCategory[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sourceUrl?: string;
}

export class CarryForwardDto {
  @ApiProperty()
  @IsInt()
  @Min(2000)
  fromYear: number;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  toYear: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;
}

export class CreateEncashmentDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  leaveTypeId?: string;

  @ApiProperty({ enum: LeaveTypeCode, required: false })
  @IsEnum(LeaveTypeCode)
  @IsOptional()
  leaveTypeCode?: LeaveTypeCode;

  @ApiProperty()
  @IsNumber()
  @Min(0.5)
  days: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
