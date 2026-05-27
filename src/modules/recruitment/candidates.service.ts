import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CandidateApplicationStatus,
  CandidateSource,
  JobPostingStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { ApplyToJobDto } from './dto/apply-to-job.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { MovePipelineStageDto } from './dto/move-pipeline-stage.dto';

const PIPELINE_ORDER: CandidateApplicationStatus[] = [
  CandidateApplicationStatus.NEW,
  CandidateApplicationStatus.SCREENING,
  CandidateApplicationStatus.SHORTLISTED,
  CandidateApplicationStatus.INTERVIEWING,
  CandidateApplicationStatus.OFFERED,
  CandidateApplicationStatus.HIRED,
];

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  /** Public application — creates/upserts candidate + creates application */
  async apply(jobPostingId: string, companyId: string, dto: ApplyToJobDto) {
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id: jobPostingId, companyId, status: JobPostingStatus.ACTIVE },
    });
    if (!posting) throw new NotFoundException('Job posting not found or not active');

    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert candidate
      let candidate = await tx.candidate.findFirst({
        where: { companyId, email: dto.email },
      });

      if (!candidate) {
        candidate = await tx.candidate.create({
          data: {
            companyId,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email,
            phone: dto.phone,
            linkedInUrl: dto.linkedInUrl,
            source: CandidateSource.CAREER_PAGE,
          },
        });
      }

      // Check for duplicate application
      const existing = await tx.candidateApplication.findUnique({
        where: {
          candidateId_jobPostingId: {
            candidateId: candidate.id,
            jobPostingId,
          },
        },
      });
      if (existing) {
        throw new BadRequestException('You have already applied to this position');
      }

      const application = await tx.candidateApplication.create({
        data: {
          companyId,
          candidateId: candidate.id,
          jobPostingId,
          coverLetter: dto.coverLetter,
          status: CandidateApplicationStatus.NEW,
        },
      });

      // Create CV document record if file provided
      let cvUploadInfo: { documentId: string; objectKey: string } | null = null;
      if (dto.cvFileName) {
        const bucket = this.config.get<string>('storage.s3.bucket') || 'hr-documents';
        const objectKey = `recruitment/cv/${candidate.id}/${Date.now()}-${dto.cvFileName}`;
        const doc = await tx.candidateDocument.create({
          data: {
            companyId,
            candidateId: candidate.id,
            fileName: dto.cvFileName,
            mimeType: dto.cvMimeType || 'application/pdf',
            bucket,
            objectKey,
            documentType: 'CV',
          },
        });
        cvUploadInfo = { documentId: doc.id, objectKey };
      }

      return { candidate, application, cvUploadInfo };
    });

    this.events.emit('candidate.applied', {
      companyId,
      candidateId: result.candidate.id,
      applicationId: result.application.id,
      jobPostingId,
    });

    return result;
  }

  async createCandidate(dto: CreateCandidateDto, companyId: string, userId: string) {
    const candidate = await this.prisma.candidate.create({
      data: {
        companyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        linkedInUrl: dto.linkedInUrl,
        source: dto.source,
        referredByEmployeeId: dto.referredByEmployeeId,
      },
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'candidate.created',
      entityType: 'Candidate',
      entityId: candidate.id,
      newValues: dto as any,
    });

    return candidate;
  }

  async findAll(
    companyId: string,
    filters: {
      page?: number;
      limit?: number;
      source?: CandidateSource;
      search?: string;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (filters.source) where.source = filters.source;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          applications: {
            include: { jobPosting: { select: { id: true, title: true } } },
          },
          _count: { select: { documents: true, notes: true } },
        },
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, companyId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id, companyId },
      include: {
        applications: {
          include: {
            jobPosting: true,
            interviews: { include: { feedbacks: true } },
            offerLetter: true,
          },
          orderBy: { appliedAt: 'desc' },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        notes: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        referredBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  /** Kanban board — candidates grouped by pipeline stage for a posting */
  async getKanbanBoard(jobPostingId: string, companyId: string) {
    const applications = await this.prisma.candidateApplication.findMany({
      where: { jobPostingId, companyId },
      include: {
        candidate: true,
        interviews: {
          orderBy: { scheduledAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const board: Record<string, typeof applications> = {};
    for (const status of Object.values(CandidateApplicationStatus)) {
      board[status] = [];
    }
    for (const app of applications) {
      board[app.status].push(app);
    }

    return board;
  }

  async moveStage(
    applicationId: string,
    dto: MovePipelineStageDto,
    companyId: string,
    userId: string,
  ) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: applicationId, companyId },
    });
    if (!application) throw new NotFoundException('Application not found');

    const now = new Date();
    const data: any = { status: dto.status, metadata: dto.notes ? { lastNote: dto.notes } : undefined };

    if (dto.status === CandidateApplicationStatus.REJECTED) data.rejectedAt = now;
    if (dto.status === CandidateApplicationStatus.WITHDRAWN) data.withdrawnAt = now;
    if (dto.status === CandidateApplicationStatus.HIRED) data.hiredAt = now;

    const updated = await this.prisma.candidateApplication.update({
      where: { id: applicationId },
      data,
      include: { candidate: true, jobPosting: true },
    });

    this.events.emit('candidate.stage_changed', {
      companyId,
      applicationId,
      oldStatus: application.status,
      newStatus: dto.status,
    });

    void this.audit.log({
      companyId,
      userId,
      action: 'candidate.stage_changed',
      entityType: 'CandidateApplication',
      entityId: applicationId,
      oldValues: { status: application.status } as any,
      newValues: { status: dto.status, notes: dto.notes } as any,
    });

    return updated;
  }

  async addNote(
    candidateId: string,
    content: string,
    companyId: string,
    userId: string,
  ) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, companyId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    return this.prisma.candidateNote.create({
      data: {
        companyId,
        candidateId,
        authorId: userId,
        content,
      },
      include: {
        author: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
