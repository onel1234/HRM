import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApplyToJobDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  linkedInUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  coverLetter?: string;

  @ApiProperty({ required: false, description: 'CV file name for presigned upload' })
  @IsString()
  @IsOptional()
  cvFileName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  cvMimeType?: string;
}
