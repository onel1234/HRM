import { ApiProperty } from '@nestjs/swagger';
import { InterviewType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ScheduleInterviewDto {
  @ApiProperty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: InterviewType, default: InterviewType.IN_PERSON })
  @IsEnum(InterviewType)
  @IsOptional()
  type?: InterviewType;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ default: 60 })
  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  meetingLink?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  interviewerUserId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
