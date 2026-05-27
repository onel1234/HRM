import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private departments: DepartmentsService) {}

  @Post()
  @Roles(UserRole.HR_MANAGER)
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departments.create(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.departments.findAll(user.companyId, includeInactive === 'true');
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departments.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles(UserRole.HR_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.departments.update(id, dto, user.companyId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.HR_MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.departments.remove(id, user.companyId, user.id);
  }
}
