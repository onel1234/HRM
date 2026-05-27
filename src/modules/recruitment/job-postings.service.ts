import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  JobPostingChannelType,
  JobPostingStatus,
  RequisitionStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { LinkedInService } from './linkedin.service';

@Injectable()
export class JobPostingsService {
  private readonly logger = new Logger(JobPostingsService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private audit: AuditService,
    private linkedIn: LinkedInService,
  ) {}

  async create(dto: CreateJobPostingDto, companyId: string, userId: string) {
    const requisition = await this.prisma.jobRequisition.findFirst({
      where: { id: dto.requisitionId, companyId },
    });
    if (!requisition) throw new NotFoundException('Requisition not found');
    if (
      requisition.status !== RequisitionStatus.OPEN &&
      requisition.status !== RequisitionStatus.APPROVED
    ) {
      throw new BadRequestException('Requisition must be approved/open to create a posting');
    }

    const channels = dto.channels || [JobPostingChannelType.CAREER_PAGE];

    const posting = await this.prisma.$transaction(async (tx) => {
      const post = await tx.jobPosting.create({
        data: {
          companyId,
          requisitionId: dto.requisitionId,
          title: dto.title,
          description: dto.description,
          requirements: dto.requirements,
          benefits: dto.benefits,
          location: dto.location,
          remotePolicy: dto.remotePolicy,
          applicationDeadline: dto.applicationDeadline
            ? new Date(dto.applicationDeadline)
            : undefined,
        },
      });

      // Create channel records
      for (const channel of channels) {
        await tx.jobPostingChannel.create({
          data: {
            jobPostingId: post.id,
            channel,
          },
        });
      }

      return tx.jobPosting.findUniqueOrThrow({
        where: { id: post.id },
        include: { channels: true, requisition: true },
      });
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'job_posting.created',
      entityType: 'JobPosting',
      entityId: posting.id,
      newValues: dto as any,
    });

    return posting;
  }

  async findAll(
    companyId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: JobPostingStatus;
      search?: string;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { channels: true, requisition: true },
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** Public career page — no auth, only ACTIVE postings */
  async findPublic(
    companyId: string,
    filters: { page?: number; limit?: number; search?: string },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
      status: JobPostingStatus.ACTIVE,
      channels: { some: { channel: JobPostingChannelType.CAREER_PAGE } },
    };
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.jobPosting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          requirements: true,
          benefits: true,
          location: true,
          remotePolicy: true,
          applicationDeadline: true,
          publishedAt: true,
          requisition: {
            select: { employmentType: true, jobTitle: true },
          },
        },
      }),
      this.prisma.jobPosting.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOnePublic(id: string, companyId: string) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: {
        id,
        companyId,
        status: JobPostingStatus.ACTIVE,
      },
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        benefits: true,
        location: true,
        remotePolicy: true,
        applicationDeadline: true,
        publishedAt: true,
        requisition: {
          select: { employmentType: true, jobTitle: true },
        },
      },
    });
    if (!posting) throw new NotFoundException('Job posting not found');

    // Increment view count asynchronously
    void this.prisma.jobPosting.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return posting;
  }

  async publish(id: string, companyId: string, userId: string) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id, companyId },
      include: { channels: true, requisition: { include: { company: true } } },
    });
    if (!posting) throw new NotFoundException('Job posting not found');
    if (posting.status !== JobPostingStatus.DRAFT && posting.status !== JobPostingStatus.PAUSED) {
      throw new BadRequestException('Posting must be in DRAFT or PAUSED status to publish');
    }

    // Publish to LinkedIn if channel exists
    const linkedInChannel = posting.channels.find(
      (c) => c.channel === JobPostingChannelType.LINKEDIN,
    );
    if (linkedInChannel) {
      const result = await this.linkedIn.publishJob({
        title: posting.title,
        description: posting.description,
        location: posting.location ?? undefined,
        companyName: posting.requisition.company.name,
      });
      if (result.externalId) {
        await this.prisma.jobPostingChannel.update({
          where: { id: linkedInChannel.id },
          data: {
            externalId: result.externalId,
            externalUrl: result.externalUrl,
            publishedAt: new Date(),
          },
        });
      }
    }

    const updated = await this.prisma.jobPosting.update({
      where: { id },
      data: {
        status: JobPostingStatus.ACTIVE,
        publishedAt: new Date(),
      },
      include: { channels: true },
    });

    // Also update the career page channel
    await this.prisma.jobPostingChannel.updateMany({
      where: {
        jobPostingId: id,
        channel: JobPostingChannelType.CAREER_PAGE,
      },
      data: { publishedAt: new Date() },
    });

    this.events.emit('job_posting.published', { companyId, postingId: id });
    void this.audit.log({
      companyId,
      userId,
      action: 'job_posting.published',
      entityType: 'JobPosting',
      entityId: id,
    });

    return updated;
  }

  async pause(id: string, companyId: string, userId: string) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id, companyId, status: JobPostingStatus.ACTIVE },
    });
    if (!posting) throw new NotFoundException('Active posting not found');

    const updated = await this.prisma.jobPosting.update({
      where: { id },
      data: { status: JobPostingStatus.PAUSED },
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'job_posting.paused',
      entityType: 'JobPosting',
      entityId: id,
    });
    return updated;
  }

  async close(id: string, companyId: string, userId: string) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id, companyId },
    });
    if (!posting) throw new NotFoundException('Job posting not found');

    // Unpublish from LinkedIn if applicable
    const linkedInChannel = await this.prisma.jobPostingChannel.findFirst({
      where: {
        jobPostingId: id,
        channel: JobPostingChannelType.LINKEDIN,
        externalId: { not: null },
      },
    });
    if (linkedInChannel?.externalId) {
      await this.linkedIn.unpublishJob(linkedInChannel.externalId);
    }

    const updated = await this.prisma.jobPosting.update({
      where: { id },
      data: { status: JobPostingStatus.CLOSED, closedAt: new Date() },
    });

    this.events.emit('job_posting.closed', { companyId, postingId: id });
    void this.audit.log({
      companyId,
      userId,
      action: 'job_posting.closed',
      entityType: 'JobPosting',
      entityId: id,
    });
    return updated;
  }
}
