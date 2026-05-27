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
  AttendancePunchDirection,
  AttendancePunchType,
  AttendanceRecordStatus,
  AttendanceWorkMode,
  OvertimeMultiplier,
} from '@prisma/client';

export class LocationDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  accuracyMeters?: number;
}

export class AttendancePunchDto extends LocationDto {
  @ApiProperty({ enum: AttendancePunchType, required: false })
  @IsEnum(AttendancePunchType)
  @IsOptional()
  type?: AttendancePunchType;

  @ApiProperty({ enum: AttendanceWorkMode, required: false })
  @IsEnum(AttendanceWorkMode)
  @IsOptional()
  workMode?: AttendanceWorkMode;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  qrToken?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  externalPunchId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAttendancePolicyDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, default: 45 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  standardWeeklyHours?: number;

  @ApiProperty({ enum: OvertimeMultiplier, required: false })
  @IsEnum(OvertimeMultiplier)
  @IsOptional()
  overtimeMultiplier?: OvertimeMultiplier;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  geofenceEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  geofence?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateShiftTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  breakMinutes?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(0)
  @IsOptional()
  graceMinutes?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  expectedHours: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isOvernight?: boolean;
}

export class UpdateShiftTemplateDto extends PartialType(
  CreateShiftTemplateDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateShiftAssignmentDto {
  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  shiftTemplateId: string;

  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateShiftAssignmentDto extends PartialType(
  CreateShiftAssignmentDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAttendanceRecordDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ enum: AttendanceWorkMode, required: false })
  @IsEnum(AttendanceWorkMode)
  @IsOptional()
  workMode?: AttendanceWorkMode;

  @ApiProperty({ enum: AttendanceRecordStatus, required: false })
  @IsEnum(AttendanceRecordStatus)
  @IsOptional()
  status?: AttendanceRecordStatus;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  firstCheckInAt?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  lastCheckOutAt?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  approvedHours?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  managerNotes?: string;
}

export class ApproveAttendanceRecordDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  approvedHours?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  managerNotes?: string;
}

export class CreateQrSessionDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  expiresAt: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateQrSessionDto extends PartialType(CreateQrSessionDto) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateBiometricDeviceDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  apiBaseUrl?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateBiometricDeviceDto extends PartialType(
  CreateBiometricDeviceDto,
) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BiometricPunchImportItemDto extends LocationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeNo?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceUserId?: string;

  @ApiProperty({ enum: AttendancePunchDirection })
  @IsEnum(AttendancePunchDirection)
  direction: AttendancePunchDirection;

  @ApiProperty()
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  externalPunchId?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  rawPayload?: Record<string, unknown>;
}

export class ImportBiometricPunchesDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({ type: [BiometricPunchImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BiometricPunchImportItemDto)
  punches: BiometricPunchImportItemDto[];
}
