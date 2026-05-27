import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateOfferTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template content with {{variable}} placeholders' })
  @IsString()
  content: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  variables?: Record<string, any>;
}
