import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { OnboardingPortalService } from './onboarding-portal.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Onboarding Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingPortalController {
  constructor(private portal: OnboardingPortalService, private prisma: PrismaService) {}

  @Get('my')
  @Roles(UserRole.EMPLOYEE)
  async getMyOnboarding(@CurrentUser() user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({ where: { userId: user.id, companyId: user.companyId } });
    if (!employee) return { message: 'No employee record found' };
    return this.portal.getMyOnboarding(employee.id, user.companyId);
  }

  @Get('instances')
  @Roles(UserRole.HR_MANAGER)
  findAllInstances(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: OnboardingStatus, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.portal.findAllInstances(user.companyId, { status, page, limit });
  }

  @Get('instances/:id')
  @Roles(UserRole.HR_MANAGER)
  findInstance(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.findInstance(id, user.companyId);
  }

  @Get('instances/:id/progress')
  @Roles(UserRole.MANAGER)
  getProgress(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.findInstance(id, user.companyId);
  }

  @Post('tasks/:taskId/complete')
  @Roles(UserRole.EMPLOYEE)
  completeTask(@Param('taskId') taskId: string, @Body('evidence') evidence: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.completeTask(taskId, user.companyId, evidence);
  }

  @Post('tasks/:taskId/skip')
  @Roles(UserRole.HR_MANAGER)
  skipTask(@Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.portal.skipTask(taskId, user.companyId);
  }
}
