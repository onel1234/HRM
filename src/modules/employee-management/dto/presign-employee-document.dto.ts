import { ApiProperty } from '@nestjs/swagger';
import { EmployeeDocumentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PresignEmployeeDocumentDto {
  @ApiProperty({ enum: EmployeeDocumentType })
  @IsEnum(EmployeeDocumentType)
  type: EmployeeDocumentType;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  @IsOptional()
  sizeBytes?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checksum?: string;
}
