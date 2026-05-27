import { ApiProperty } from '@nestjs/swagger';
import { CandidateApplicationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class MovePipelineStageDto {
  @ApiProperty({ enum: CandidateApplicationStatus })
  @IsEnum(CandidateApplicationStatus)
  status: CandidateApplicationStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
