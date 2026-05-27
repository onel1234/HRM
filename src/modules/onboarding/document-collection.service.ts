import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentRequestStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';

@Injectable()
export class DocumentCollectionService {
  private readonly logger = new Logger(DocumentCollectionService.name);

  constructor(private prisma: PrismaService, private audit: AuditService, private config: ConfigService) {}

  async createRequest(dto: CreateDocumentRequestDto, companyId: string, userId: string) {
    const instance = await this.prisma.onboardingInstance.findFirst({ where: { id: dto.onboardingInstanceId, companyId } });
    if (!instance) throw new NotFoundException('Onboarding instance not found');

    const request = await this.prisma.documentRequest.create({
      data: {
        companyId, onboardingInstanceId: dto.onboardingInstanceId,
        title: dto.title, description: dto.description,
        documentType: dto.documentType || 'OTHER',
        required: dto.required ?? true,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    void this.audit.log({ companyId, userId, action: 'document_request.created', entityType: 'DocumentRequest', entityId: request.id });
    return request;
  }

  async findByInstance(instanceId: string, companyId: string) {
    return this.prisma.documentRequest.findMany({
      where: { onboardingInstanceId: instanceId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyDocumentRequests(employeeId: string, companyId: string) {
    const instance = await this.prisma.onboardingInstance.findFirst({ where: { employeeId, companyId } });
    if (!instance) return [];
    return this.prisma.documentRequest.findMany({
      where: { onboardingInstanceId: instance.id },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async presignUpload(id: string, companyId: string, fileName: string, mimeType: string) {
    const req = await this.prisma.documentRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Document request not found');

    const bucket = this.config.get<string>('storage.s3.bucket') || 'hr-documents';
    const objectKey = `onboarding/documents/${req.onboardingInstanceId}/${id}/${Date.now()}-${fileName}`;

    await this.prisma.documentRequest.update({
      where: { id },
      data: { fileName, mimeType, bucket, objectKey },
    });

    // In production, generate S3 presigned URL here
    return { bucket, objectKey, uploadUrl: `https://s3.placeholder/${bucket}/${objectKey}` };
  }

  async completeUpload(id: string, companyId: string, sizeBytes?: number) {
    const req = await this.prisma.documentRequest.findFirst({ where: { id, companyId } });
    if (!req) throw new NotFoundException('Document request not found');

    return this.prisma.documentRequest.update({
      where: { id },
      data: { status: DocumentRequestStatus.UPLOADED, uploadedAt: new Date(), sizeBytes },
    });
  }

  async approve(id: string, companyId: string, userId: string) {
    const req = await this.prisma.documentRequest.findFirst({ where: { id, companyId, status: DocumentRequestStatus.UPLOADED } });
    if (!req) throw new NotFoundException('Uploaded document not found');

    const updated = await this.prisma.documentRequest.update({
      where: { id },
      data: { status: DocumentRequestStatus.APPROVED, approvedAt: new Date() },
    });

    void this.audit.log({ companyId, userId, action: 'document_request.approved', entityType: 'DocumentRequest', entityId: id });
    return updated;
  }

  async reject(id: string, companyId: string, userId: string, reason?: string) {
    const req = await this.prisma.documentRequest.findFirst({ where: { id, companyId, status: DocumentRequestStatus.UPLOADED } });
    if (!req) throw new NotFoundException('Uploaded document not found');

    const updated = await this.prisma.documentRequest.update({
      where: { id },
      data: { status: DocumentRequestStatus.REJECTED, rejectedAt: new Date(), rejectionReason: reason },
    });

    void this.audit.log({ companyId, userId, action: 'document_request.rejected', entityType: 'DocumentRequest', entityId: id });
    return updated;
  }
}
