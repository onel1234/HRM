import { ApiProperty } from '@nestjs/swagger';
import { RequisitionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ApproveRequisitionDto {
  @ApiProperty({ enum: [RequisitionStatus.APPROVED, RequisitionStatus.REJECTED] })
  @IsEnum(RequisitionStatus)
  status: RequisitionStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
