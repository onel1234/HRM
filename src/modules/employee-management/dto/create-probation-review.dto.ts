import { ApiProperty } from '@nestjs/swagger';
import { ProbationReviewOutcome } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateProbationReviewDto {
  @ApiProperty({ enum: ProbationReviewOutcome })
  @IsEnum(ProbationReviewOutcome)
  outcome: ProbationReviewOutcome;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  nextReviewDate?: string;
}
