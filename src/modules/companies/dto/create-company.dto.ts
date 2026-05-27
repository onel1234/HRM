import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  registrationNo?: string;

  @IsString()
  @IsOptional()
  taxNo?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
