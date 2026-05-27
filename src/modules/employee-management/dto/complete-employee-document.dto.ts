import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteEmployeeDocumentDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checksum?: string;
}
