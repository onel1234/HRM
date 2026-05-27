import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { CandidateApplicationStatus, OfferStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OfferTemplateService } from './offer-template.service';
import { SignatureService } from './signature.service';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private audit: AuditService,
    private config: ConfigService,
    private templates: OfferTemplateService,
    private signatures: SignatureService,
  ) {}

  async create(dto: CreateOfferDto, companyId: string, userId: string) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: dto.applicationId, companyId },
    });
    if (!application) throw new NotFoundException('Application not found');

    const expiryDays = this.config.get<number>('recruitment.offerTokenExpiryDays') || 7;
    const offer = await this.prisma.offerLetter.create({
      data: {
        companyId, applicationId: dto.applicationId, templateId: dto.templateId,
        createdByUserId: userId, jobTitle: dto.jobTitle, department: dto.department,
        salary: dto.salary, startDate: new Date(dto.startDate),
        benefits: dto.benefits ?? undefined, customFields: dto.customFields ?? undefined,
        offerToken: uuidv4(),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + expiryDays * 86400000),
      },
      include: { application: { include: { candidate: true, jobPosting: true } }, template: true },
    });

    await this.prisma.candidateApplication.update({
      where: { id: dto.applicationId },
      data: { status: CandidateApplicationStatus.OFFERED },
    });

    void this.audit.log({ companyId, userId, action: 'offer.created', entityType: 'OfferLetter', entityId: offer.id, newValues: dto as any });
    return offer;
  }

  async findAll(companyId: string, filters: { page?: number; limit?: number; status?: OfferStatus }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { companyId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.offerLetter.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { application: { include: { candidate: { select: { firstName: true, lastName: true, email: true } }, jobPosting: { select: { title: true } } } }, signatureRequest: true },
      }),
      this.prisma.offerLetter.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string, companyId: string) {
    const offer = await this.prisma.offerLetter.findFirst({
      where: { id, companyId },
      include: { application: { include: { candidate: true, jobPosting: true } }, template: true, signatureRequest: true, createdBy: { select: { firstName: true, lastName: true } }, approvedBy: { select: { firstName: true, lastName: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async generatePdf(id: string, companyId: string) {
    const offer = await this.prisma.offerLetter.findFirst({
      where: { id, companyId },
      include: { application: { include: { candidate: true, jobPosting: { include: { requisition: { include: { company: true } } } } } }, template: true },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const vars: Record<string, any> = {
      candidateName: `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`,
      jobTitle: offer.jobTitle, department: offer.department || '', salary: offer.salary.toString(),
      startDate: offer.startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      companyName: offer.application.jobPosting.requisition.company.name,
      ...(offer.customFields as Record<string, any> || {}),
    };

    const content = offer.template ? this.templates.renderContent(offer.template.content, vars) : this.defaultContent(vars);
    const pdfBuffer = await this.templates.generatePdf(content, { companyName: vars.companyName, candidateName: vars.candidateName, jobTitle: vars.jobTitle });
    const objectKey = `recruitment/offers/${offer.id}/offer-letter.pdf`;
    await this.prisma.offerLetter.update({ where: { id }, data: { pdfObjectKey: objectKey } });
    return { pdfBuffer, objectKey };
  }

  async approve(id: string, companyId: string, userId: string) {
    const offer = await this.prisma.offerLetter.findFirst({ where: { id, companyId, status: OfferStatus.DRAFT } });
    if (!offer) throw new NotFoundException('Draft offer not found');
    return this.prisma.offerLetter.update({ where: { id }, data: { status: OfferStatus.APPROVED, approvedByUserId: userId, approvedAt: new Date() } });
  }

  async send(id: string, companyId: string, userId: string) {
    const offer = await this.prisma.offerLetter.findFirst({ where: { id, companyId, status: OfferStatus.APPROVED }, include: { application: { include: { candidate: true } } } });
    if (!offer) throw new NotFoundException('Approved offer not found');

    await this.signatures.createSignatureRequest(id, companyId, offer.application.candidate.email, `${offer.application.candidate.firstName} ${offer.application.candidate.lastName}`, offer.pdfObjectKey ?? undefined);
    const updated = await this.prisma.offerLetter.update({ where: { id }, data: { status: OfferStatus.SENT, sentAt: new Date() } });
    this.events.emit('offer.sent', { companyId, offerId: id });
    return updated;
  }

  async revoke(id: string, companyId: string, userId: string) {
    const offer = await this.prisma.offerLetter.findFirst({ where: { id, companyId } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status === OfferStatus.ACCEPTED || offer.status === OfferStatus.REVOKED) throw new BadRequestException('Cannot revoke');
    return this.prisma.offerLetter.update({ where: { id }, data: { status: OfferStatus.REVOKED, revokedAt: new Date() } });
  }

  async findByToken(token: string) {
    const offer = await this.prisma.offerLetter.findFirst({ where: { offerToken: token }, include: { application: { include: { candidate: { select: { firstName: true, lastName: true } }, jobPosting: { select: { title: true } } } }, signatureRequest: true } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async respond(token: string, response: 'accept' | 'decline') {
    const offer = await this.prisma.offerLetter.findFirst({
      where: { offerToken: token, status: OfferStatus.SENT },
      include: { application: { include: { candidate: true, jobPosting: { include: { requisition: true } } } } },
    });
    if (!offer) throw new NotFoundException('Sent offer not found');
    if (offer.expiresAt && new Date() > offer.expiresAt) {
      await this.prisma.offerLetter.update({ where: { id: offer.id }, data: { status: OfferStatus.EXPIRED } });
      throw new BadRequestException('Offer has expired');
    }

    const isAccepted = response === 'accept';
    const updated = await this.prisma.offerLetter.update({
      where: { id: offer.id },
      data: { status: isAccepted ? OfferStatus.ACCEPTED : OfferStatus.DECLINED, respondedAt: new Date(), candidateResponse: response },
    });

    if (isAccepted) {
      const sigReq = await this.prisma.signatureRequest.findFirst({ where: { offerLetterId: offer.id } });
      if (sigReq?.signToken) await this.signatures.handleLocalSign(sigReq.signToken);

      await this.prisma.candidateApplication.update({ where: { id: offer.applicationId }, data: { status: CandidateApplicationStatus.HIRED, hiredAt: new Date() } });

      const c = offer.application.candidate;
      const r = offer.application.jobPosting.requisition;
      const employee = await this.prisma.employee.create({
        data: {
          companyId: offer.companyId, firstName: c.firstName, lastName: c.lastName,
          workEmail: c.email, personalEmail: c.email, phone: c.phone,
          jobTitle: offer.jobTitle, employmentType: r.employmentType,
          departmentId: r.departmentId, joinedAt: offer.startDate,
          probationStartDate: offer.startDate,
          probationEndDate: new Date(offer.startDate.getTime() + 90 * 86400000),
        },
      });
      this.events.emit('offer.accepted', { companyId: offer.companyId, offerId: offer.id, employeeId: employee.id });
    }
    return updated;
  }

  private defaultContent(v: Record<string, any>): string {
    return `We are pleased to extend an offer for the position of ${v.jobTitle} at ${v.companyName}.\n\nCompensation: ${v.salary} per annum, starting ${v.startDate}.\n\n${v.department ? `Department: ${v.department}\n\n` : ''}This offer is contingent upon successful completion of pre-employment requirements.\n\nPlease sign below to accept.`;
  }
}
