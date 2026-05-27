import { ApiProperty } from '@nestjs/swagger';
import { SeparationType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSeparationDto {
  @ApiProperty({ enum: SeparationType })
  @IsEnum(SeparationType)
  type: SeparationType;

  @ApiProperty()
  @IsString()
  reason: string;

  @ApiProperty()
  @IsDateString()
  effectiveDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
