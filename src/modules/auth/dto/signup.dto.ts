import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'Acme Lanka' })
  @IsString()
  companyName: string;

  @ApiProperty({ example: 'hello@acme.lk', required: false })
  @IsEmail()
  @IsOptional()
  companyEmail?: string;

  @ApiProperty({ example: '+94112345678', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'User' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'admin@acme.lk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
