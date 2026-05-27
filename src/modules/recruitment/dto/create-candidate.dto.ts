import { ApiProperty } from '@nestjs/swagger';
import { CandidateSource } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCandidateDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  linkedInUrl?: string;

  @ApiProperty({ enum: CandidateSource, default: CandidateSource.MANUAL })
  @IsEnum(CandidateSource)
  @IsOptional()
  source?: CandidateSource;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  referredByEmployeeId?: string;
}
