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
import { JobPostingStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { JobPostingsService } from './job-postings.service';

@ApiTags('Job Postings')
@Controller({ version: '1' })
export class JobPostingsController {
  constructor(private postings: JobPostingsService) {}

  // ─── Authenticated endpoints ────────────────────────────────

  @Post('job-postings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  create(
    @Body() dto: CreateJobPostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postings.create(dto, user.companyId, user.id);
  }

  @Get('job-postings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: JobPostingStatus,
    @Query('search') search?: string,
  ) {
    return this.postings.findAll(user.companyId, { page, limit, status, search });
  }

  @Post('job-postings/:id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postings.publish(id, user.companyId, user.id);
  }

  @Post('job-postings/:id/pause')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  pause(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postings.pause(id, user.companyId, user.id);
  }

  @Post('job-postings/:id/close')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postings.close(id, user.companyId, user.id);
  }

  // ─── Public career page endpoints ──────────────────────────

  @Get('public/jobs')
  @Public()
  findPublicJobs(
    @Query('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.postings.findPublic(companyId, { page, limit, search });
  }

  @Get('public/jobs/:id')
  @Public()
  findOnePublicJob(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
  ) {
    return this.postings.findOnePublic(id, companyId);
  }
}
