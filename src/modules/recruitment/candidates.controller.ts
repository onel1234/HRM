import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CandidateSource, UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ApplyToJobDto } from './dto/apply-to-job.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { MovePipelineStageDto } from './dto/move-pipeline-stage.dto';
import { CandidatesService } from './candidates.service';

@ApiTags('Candidates')
@Controller({ version: '1' })
export class CandidatesController {
  constructor(private candidates: CandidatesService) {}

  // ─── Public application endpoint ───────────────────────────

  @Post('public/jobs/:jobPostingId/apply')
  @Public()
  apply(
    @Param('jobPostingId') jobPostingId: string,
    @Query('companyId') companyId: string,
    @Body() dto: ApplyToJobDto,
  ) {
    return this.candidates.apply(jobPostingId, companyId, dto);
  }

  // ─── Authenticated endpoints ───────────────────────────────

  @Post('candidates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  create(
    @Body() dto: CreateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.createCandidate(dto, user.companyId, user.id);
  }

  @Get('candidates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('source') source?: CandidateSource,
    @Query('search') search?: string,
  ) {
    return this.candidates.findAll(user.companyId, {
      page,
      limit,
      source,
      search,
    });
  }

  @Get('candidates/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.candidates.findOne(id, user.companyId);
  }

  @Get('job-postings/:id/pipeline')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  getKanbanBoard(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.getKanbanBoard(id, user.companyId);
  }

  @Post('applications/:id/move-stage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  moveStage(
    @Param('id') id: string,
    @Body() dto: MovePipelineStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.moveStage(id, dto, user.companyId, user.id);
  }

  @Post('candidates/:id/notes')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER)
  addNote(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.candidates.addNote(id, content, user.companyId, user.id);
  }
}
