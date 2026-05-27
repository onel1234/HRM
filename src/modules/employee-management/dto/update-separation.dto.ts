import { ApiProperty } from '@nestjs/swagger';
import { SeparationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateSeparationDto {
  @ApiProperty({
    enum: [
      SeparationStatus.APPROVED,
      SeparationStatus.REJECTED,
      SeparationStatus.CANCELLED,
      SeparationStatus.COMPLETED,
    ],
  })
  @IsEnum(SeparationStatus)
  status: SeparationStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
