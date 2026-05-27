import { ApiProperty } from '@nestjs/swagger';
import { JobPostingChannelType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJobPostingDto {
  @ApiProperty()
  @IsString()
  requisitionId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  requirements?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  benefits?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  remotePolicy?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  applicationDeadline?: string;

  @ApiProperty({
    enum: JobPostingChannelType,
    isArray: true,
    default: [JobPostingChannelType.CAREER_PAGE],
  })
  @IsArray()
  @IsEnum(JobPostingChannelType, { each: true })
  @IsOptional()
  channels?: JobPostingChannelType[];
}
