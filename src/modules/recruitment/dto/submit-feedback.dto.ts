import { ApiProperty } from '@nestjs/swagger';
import { InterviewDecision } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitFeedbackDto {
  @ApiProperty({ enum: InterviewDecision })
  @IsEnum(InterviewDecision)
  decision: InterviewDecision;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  technicalScore?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  communicationScore?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  cultureFitScore?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  overallScore?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  strengths?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  concerns?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
