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
  CalibrationSessionStatus,
  FeedbackRelationship,
  FeedbackRequestStatus,
  PerformanceCadence,
  PerformanceCheckInStatus,
  PerformanceCycleStatus,
  PerformanceCycleType,
  PerformanceGoalScope,
  PerformanceGoalStatus,
  PerformanceGoalType,
  PerformanceReviewStatus,
  PipStatus,
  SalaryIncrementStatus,
} from '@prisma/client';

export class CreatePerformanceCycleDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: PerformanceCycleType, required: false })
  @IsEnum(PerformanceCycleType)
  @IsOptional()
  type?: PerformanceCycleType;

  @ApiProperty({ enum: PerformanceCadence, required: false })
  @IsEnum(PerformanceCadence)
  @IsOptional()
  cadence?: PerformanceCadence;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  midYearReviewDate?: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  calibrationDueDate?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  minRating?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxRating?: number;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  salaryLinkEnabled?: boolean;
}

export class UpdatePerformanceCycleDto extends PartialType(
  CreatePerformanceCycleDto,
) {
  @ApiProperty({ enum: PerformanceCycleStatus, required: false })
  @IsEnum(PerformanceCycleStatus)
  @IsOptional()
  status?: PerformanceCycleStatus;
}

export class CreatePerformanceGoalDto {
  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  parentGoalId?: string;

  @ApiProperty({ enum: PerformanceGoalType, required: false })
  @IsEnum(PerformanceGoalType)
  @IsOptional()
  type?: PerformanceGoalType;

  @ApiProperty({ enum: PerformanceGoalScope, required: false })
  @IsEnum(PerformanceGoalScope)
  @IsOptional()
  scope?: PerformanceGoalScope;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  metricName?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  targetValue?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  currentValue?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  weight?: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class UpdatePerformanceGoalDto extends PartialType(
  CreatePerformanceGoalDto,
) {
  @ApiProperty({ enum: PerformanceGoalStatus, required: false })
  @IsEnum(PerformanceGoalStatus)
  @IsOptional()
  status?: PerformanceGoalStatus;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;
}

export class ScheduleCheckInsDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  goalId?: string;
}

export class CreateCheckInDto {
  @ApiProperty()
  @IsString()
  goalId: string;

  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  managerUserId?: string;

  @ApiProperty()
  @IsDateString()
  dueDate: string;
}

export class CompleteCheckInDto {
  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  progressUpdate?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  confidenceScore?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  blockers?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nextSteps?: string;
}

export class CreateFeedbackRequestDto {
  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reviewId?: string;

  @ApiProperty()
  @IsString()
  subjectEmployeeId: string;

  @ApiProperty()
  @IsString()
  reviewerUserId: string;

  @ApiProperty({ enum: FeedbackRelationship })
  @IsEnum(FeedbackRelationship)
  relationship: FeedbackRelationship;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class SubmitFeedbackDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  strengths?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  improvements?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  valuesRating?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  performanceRating?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comments?: string;

  @ApiProperty({ enum: FeedbackRequestStatus, required: false })
  @IsEnum(FeedbackRequestStatus)
  @IsOptional()
  status?: FeedbackRequestStatus;
}

export class CreatePerformanceReviewDto {
  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  managerUserId?: string;
}

export class SubmitSelfReviewDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  selfSummary?: string;
}

export class SubmitManagerReviewDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(5)
  managerRating: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  managerSummary?: string;
}

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: PerformanceReviewStatus })
  @IsEnum(PerformanceReviewStatus)
  status: PerformanceReviewStatus;
}

export class CreateCalibrationSessionDto {
  @ApiProperty()
  @IsString()
  cycleId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpsertCalibrationItemDto {
  @ApiProperty()
  @IsString()
  reviewId: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  proposedRating?: number;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  calibratedRating?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rationale?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryIncrementPercent?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  incrementAmount?: number;
}

export class CompleteCalibrationSessionDto {
  @ApiProperty({ enum: CalibrationSessionStatus, required: false })
  @IsEnum(CalibrationSessionStatus)
  @IsOptional()
  status?: CalibrationSessionStatus;
}

export class UpsertSalaryIncrementDto {
  @ApiProperty()
  @IsString()
  reviewId: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  recommendedPercent?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  recommendedAmount?: number;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  rationale?: string;
}

export class DecideSalaryIncrementDto {
  @ApiProperty({ enum: SalaryIncrementStatus })
  @IsEnum(SalaryIncrementStatus)
  status: SalaryIncrementStatus;

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
}

export class CreatePipDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cycleId?: string;

  @ApiProperty()
  @IsString()
  employeeId: string;

  @ApiProperty()
  @IsString()
  managerUserId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reviewId?: string;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiProperty()
  @IsString()
  successCriteria: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  supportPlan?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  checkpoints?: Record<string, unknown>;
}

export class UpdatePipDto extends PartialType(CreatePipDto) {
  @ApiProperty({ enum: PipStatus, required: false })
  @IsEnum(PipStatus)
  @IsOptional()
  status?: PipStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  outcomeNotes?: string;
}

export class BulkFeedbackRequestDto {
  @ApiProperty({ type: [CreateFeedbackRequestDto] })
  @IsArray()
  requests: CreateFeedbackRequestDto[];
}

export class ListPerformanceQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cycleId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  status?: string;
}

export class CheckInQueryDto extends ListPerformanceQueryDto {
  @ApiProperty({ enum: PerformanceCheckInStatus, required: false })
  @IsEnum(PerformanceCheckInStatus)
  @IsOptional()
  checkInStatus?: PerformanceCheckInStatus;
}
