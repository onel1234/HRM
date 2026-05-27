import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequisitionStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { RequisitionsService } from './requisitions.service';

@ApiTags('Requisitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'requisitions', version: '1' })
export class RequisitionsController {
  constructor(private requisitions: RequisitionsService) {}

  @Post()
  @Roles(UserRole.MANAGER)
  create(
    @Body() dto: CreateRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requisitions.create(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: RequisitionStatus,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    return this.requisitions.findAll(user.companyId, {
      page,
      limit,
      status,
      departmentId,
      priority,
      search,
    });
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requisitions.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateRequisitionDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requisitions.update(id, dto, user.companyId, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.HR_MANAGER)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requisitions.approve(id, dto, user.companyId, user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.MANAGER)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requisitions.cancel(id, user.companyId, user.id);
  }
}
