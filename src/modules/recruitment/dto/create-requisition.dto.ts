import { ApiProperty } from '@nestjs/swagger';
import {
  EmploymentType,
  RequisitionPriority,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRequisitionDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty()
  @IsString()
  hiringManagerId: string;

  @ApiProperty()
  @IsString()
  jobTitle: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  requirements?: Record<string, any>;

  @ApiProperty({ enum: EmploymentType, default: EmploymentType.PERMANENT })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  headcount?: number;

  @ApiProperty({ enum: RequisitionPriority, default: RequisitionPriority.MEDIUM })
  @IsEnum(RequisitionPriority)
  @IsOptional()
  priority?: RequisitionPriority;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  salaryRangeMin?: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  salaryRangeMax?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  desiredStartDate?: string;
}
