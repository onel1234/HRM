import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOfferDto {
  @ApiProperty()
  @IsString()
  applicationId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiProperty()
  @IsString()
  jobTitle: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty()
  @IsNumber()
  salary: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  benefits?: Record<string, any>;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
