import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { OnboardingChecklistsService } from './onboarding-checklists.service';

@ApiTags('Onboarding Checklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'onboarding/checklists', version: '1' })
export class OnboardingChecklistsController {
  constructor(private checklists: OnboardingChecklistsService) {}

  @Post()
  @Roles(UserRole.HR_MANAGER)
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checklists.create(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.HR_MANAGER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.checklists.findAll(user.companyId);
  }

  @Get(':id')
  @Roles(UserRole.HR_MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.checklists.findOne(id, user.companyId);
  }

  @Post(':id/assign')
  @Roles(UserRole.HR_MANAGER)
  assign(
    @Param('id') id: string,
    @Body('employeeId') employeeId: string,
    @Body('startDate') startDate: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checklists.assignToEmployee(id, employeeId, user.companyId, new Date(startDate), user.id);
  }
}
