import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EmployeeDocumentStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CompleteEmployeeDocumentDto } from './dto/complete-employee-document.dto';
import { PresignEmployeeDocumentDto } from './dto/presign-employee-document.dto';
import { S3PresignerService } from './s3-presigner.service';

const documentSelect = {
  id: true,
  employeeId: true,
  type: true,
  status: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  checksum: true,
  uploadedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private prisma: PrismaService,
    private presigner: S3PresignerService,
    private audit: AuditService,
    private eventBus: EventBusService,
  ) {}

  async createUploadUrl(
    employeeId: string,
    dto: PresignEmployeeDocumentDto,
    companyId: string,
    actorId: string,
  ) {
    await this.assertEmployee(employeeId, companyId);
    const objectKey = this.buildObjectKey(companyId, employeeId, dto.fileName);
    const document = await this.prisma.employeeDocument.create({
      data: {
        companyId,
        employeeId,
        uploadedByUserId: actorId,
        type: dto.type,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        checksum: dto.checksum,
        bucket: this.presigner.bucket,
        objectKey,
      },
      select: documentSelect,
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employeeDocument.uploadRequested',
      entityType: 'EmployeeDocument',
      entityId: document.id,
      metadata: { employeeId, type: dto.type, fileName: dto.fileName },
    });
    this.eventBus.emit('employeeDocument.uploadRequested', {
      companyId,
      employeeId,
      documentId: document.id,
      type: dto.type,
    });

    return {
      document,
      uploadUrl: this.presigner.presign('PUT', objectKey),
      expiresInSeconds: 900,
    };
  }

  async completeUpload(
    employeeId: string,
    documentId: string,
    dto: CompleteEmployeeDocumentDto,
    companyId: string,
    actorId: string,
  ) {
    await this.assertEmployee(employeeId, companyId);
    const current = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, employeeId, companyId },
      select: { id: true, status: true },
    });
    if (!current) throw new NotFoundException('Document not found');
    if (current.status === EmployeeDocumentStatus.ARCHIVED) {
      throw new BadRequestException('Archived documents cannot be completed');
    }

    const document = await this.prisma.employeeDocument.update({
      where: { id: documentId },
      data: {
        status: EmployeeDocumentStatus.AVAILABLE,
        uploadedAt: new Date(),
        checksum: dto.checksum,
      },
      select: documentSelect,
    });

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'employeeDocument.uploadCompleted',
      entityType: 'EmployeeDocument',
      entityId: documentId,
      metadata: { employeeId },
    });
    this.eventBus.emit('employeeDocument.uploadCompleted', {
      companyId,
      employeeId,
      documentId,
    });

    return document;
  }

  async createDownloadUrl(
    employeeId: string,
    documentId: string,
    companyId: string,
  ) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        employeeId,
        companyId,
        status: EmployeeDocumentStatus.AVAILABLE,
      },
      select: {
        ...documentSelect,
        objectKey: true,
      },
    });
    if (!document) throw new NotFoundException('Document not found');

    const { objectKey, ...safeDocument } = document;
    return {
      document: safeDocument,
      downloadUrl: this.presigner.presign('GET', objectKey),
      expiresInSeconds: 900,
    };
  }

  private async assertEmployee(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
  }

  private buildObjectKey(
    companyId: string,
    employeeId: string,
    fileName: string,
  ) {
    const extension = fileName.includes('.')
      ? fileName.split('.').pop()
      : undefined;
    const suffix = extension ? `.${extension}` : '';
    return `companies/${companyId}/employees/${employeeId}/documents/${randomUUID()}${suffix}`;
  }
}
