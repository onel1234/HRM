import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InterviewStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { CalendarSyncService } from './calendar-sync.service';

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private audit: AuditService,
    private calendar: CalendarSyncService,
  ) {}

  async schedule(dto: ScheduleInterviewDto, companyId: string, userId: string) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: dto.applicationId, companyId },
      include: { candidate: true, jobPosting: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    const interview = await this.prisma.interview.create({
      data: {
        companyId,
        applicationId: dto.applicationId,
        scheduledByUserId: userId,
        interviewerUserId: dto.interviewerUserId,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes || 60,
        location: dto.location,
        meetingLink: dto.meetingLink,
        notes: dto.notes,
      },
      include: {
        application: { include: { candidate: true, jobPosting: true } },
        scheduledBy: { select: { firstName: true, lastName: true, email: true } },
        interviewer: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    this.events.emit('interview.scheduled', {
      companyId,
      interviewId: interview.id,
      applicationId: dto.applicationId,
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'interview.scheduled',
      entityType: 'Interview',
      entityId: interview.id,
      newValues: dto as any,
    });

    return interview;
  }

  async findByApplication(applicationId: string, companyId: string) {
    return this.prisma.interview.findMany({
      where: { applicationId, companyId },
      include: {
        scheduledBy: { select: { firstName: true, lastName: true } },
        interviewer: { select: { firstName: true, lastName: true } },
        feedbacks: {
          include: {
            reviewer: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findAll(
    companyId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: InterviewStatus;
      from?: string;
      to?: string;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.scheduledAt = {};
      if (filters.from) where.scheduledAt.gte = new Date(filters.from);
      if (filters.to) where.scheduledAt.lte = new Date(filters.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          application: {
            include: {
              candidate: { select: { firstName: true, lastName: true, email: true } },
              jobPosting: { select: { title: true } },
            },
          },
          interviewer: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.interview.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, companyId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId },
      include: {
        application: {
          include: {
            candidate: true,
            jobPosting: true,
          },
        },
        scheduledBy: { select: { firstName: true, lastName: true, email: true } },
        interviewer: { select: { firstName: true, lastName: true, email: true } },
        feedbacks: {
          include: {
            reviewer: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    return interview;
  }

  async confirm(id: string, companyId: string, userId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId, status: InterviewStatus.SCHEDULED },
    });
    if (!interview) throw new NotFoundException('Scheduled interview not found');

    return this.prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.CONFIRMED },
    });
  }

  async cancel(id: string, companyId: string, userId: string) {
    const interview = await this.prisma.interview.findFirst({
      where: { id, companyId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const updated = await this.prisma.interview.update({
      where: { id },
      data: { status: InterviewStatus.CANCELLED, cancelledAt: new Date() },
    });

    this.events.emit('interview.cancelled', { companyId, interviewId: id });
    void this.audit.log({
      companyId,
      userId,
      action: 'interview.cancelled',
      entityType: 'Interview',
      entityId: id,
    });

    return updated;
  }

  async submitFeedback(
    interviewId: string,
    dto: SubmitFeedbackDto,
    companyId: string,
    userId: string,
  ) {
    const interview = await this.prisma.interview.findFirst({
      where: { id: interviewId, companyId },
    });
    if (!interview) throw new NotFoundException('Interview not found');

    const feedback = await this.prisma.interviewFeedback.create({
      data: {
        companyId,
        interviewId,
        reviewerUserId: userId,
        decision: dto.decision,
        technicalScore: dto.technicalScore,
        communicationScore: dto.communicationScore,
        cultureFitScore: dto.cultureFitScore,
        overallScore: dto.overallScore,
        strengths: dto.strengths,
        concerns: dto.concerns,
        notes: dto.notes,
      },
    });

    // Mark interview as completed if not already
    if (interview.status !== InterviewStatus.COMPLETED) {
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: { status: InterviewStatus.COMPLETED, completedAt: new Date() },
      });
    }

    this.events.emit('interview.feedback_submitted', {
      companyId,
      interviewId,
      feedbackId: feedback.id,
    });

    return feedback;
  }

  /** Generate .ics file content for an interview */
  generateIcs(interview: {
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    location?: string | null;
    meetingLink?: string | null;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    organizerName: string;
    organizerEmail: string;
  }): string {
    const summary = `Interview: ${interview.candidateName} — ${interview.jobTitle}`;
    const description = interview.meetingLink
      ? `Meeting Link: ${interview.meetingLink}`
      : undefined;

    return this.calendar.generateIcsContent({
      uid: `interview-${interview.id}@hrsystem`,
      summary,
      description,
      location: interview.location ?? undefined,
      startTime: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      organizerName: interview.organizerName,
      organizerEmail: interview.organizerEmail,
      attendeeEmail: interview.candidateEmail,
      attendeeName: interview.candidateName,
    });
  }
}
