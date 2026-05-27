import { ApiProperty } from '@nestjs/swagger';
import { EmploymentType, UserRole } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateEmployeePortalUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class CreateEmployeeDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false })
  @ValidateNested()
  @Type(() => CreateEmployeePortalUserDto)
  @IsOptional()
  portalUser?: CreateEmployeePortalUserDto;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reportingManagerId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  employeeNo?: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  preferredName?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  workEmail?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  personalEmail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nicNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({ enum: EmploymentType, default: EmploymentType.PERMANENT })
  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @ApiProperty()
  @IsDateString()
  joinedAt: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  probationStartDate?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  probationEndDate?: string;
}
