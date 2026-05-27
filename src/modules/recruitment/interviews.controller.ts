import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InterviewStatus, UserRole } from '@prisma/client';
import * as express from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { InterviewsService } from './interviews.service';

@ApiTags('Interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'interviews', version: '1' })
export class InterviewsController {
  constructor(private interviews: InterviewsService) {}

  @Post()
  @Roles(UserRole.HR_MANAGER)
  schedule(
    @Body() dto: ScheduleInterviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interviews.schedule(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: InterviewStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.interviews.findAll(user.companyId, {
      page,
      limit,
      status,
      from,
      to,
    });
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.findOne(id, user.companyId);
  }

  @Post(':id/confirm')
  @Roles(UserRole.MANAGER)
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.confirm(id, user.companyId, user.id);
  }

  @Post(':id/cancel')
  @Roles(UserRole.HR_MANAGER)
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.interviews.cancel(id, user.companyId, user.id);
  }

  @Post(':id/feedback')
  @Roles(UserRole.MANAGER)
  submitFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interviews.submitFeedback(id, dto, user.companyId, user.id);
  }

  @Get(':id/ics')
  @Roles(UserRole.MANAGER)
  async downloadIcs(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: express.Response,
  ) {
    const interview = await this.interviews.findOne(id, user.companyId);
    const icsContent = this.interviews.generateIcs({
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      location: interview.location,
      meetingLink: interview.meetingLink,
      candidateName: `${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`,
      candidateEmail: interview.application.candidate.email,
      jobTitle: interview.application.jobPosting.title,
      organizerName: `${interview.scheduledBy.firstName} ${interview.scheduledBy.lastName}`,
      organizerEmail: interview.scheduledBy.email || '',
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interview-${id}.ics"`,
    );
    res.send(icsContent);
  }
}
