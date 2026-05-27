import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateDocumentRequestDto {
  @ApiProperty()
  @IsString()
  onboardingInstanceId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ default: 'OTHER' })
  @IsString()
  @IsOptional()
  documentType?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
