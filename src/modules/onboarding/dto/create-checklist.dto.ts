import { ApiProperty } from '@nestjs/swagger';
import { OnboardingTaskType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOnboardingTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: OnboardingTaskType, default: OnboardingTaskType.CUSTOM })
  @IsEnum(OnboardingTaskType)
  @IsOptional()
  type?: OnboardingTaskType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assigneeRole?: string;

  @ApiProperty({ default: 7 })
  @IsInt()
  @Min(1)
  @IsOptional()
  dueDaysFromStart?: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiProperty({ default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class CreateChecklistDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({ type: [CreateOnboardingTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOnboardingTaskDto)
  tasks: CreateOnboardingTaskDto[];
}
