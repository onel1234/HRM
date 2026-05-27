import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'companies', version: '1' })
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }
}
