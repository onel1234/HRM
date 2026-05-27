/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  EmployeeDocumentStatus: {
    PENDING_UPLOAD: 'PENDING_UPLOAD',
    AVAILABLE: 'AVAILABLE',
    ARCHIVED: 'ARCHIVED',
  },
  EmployeeDocumentType: {
    NIC: 'NIC',
    PASSPORT: 'PASSPORT',
    CONTRACT: 'CONTRACT',
    CERTIFICATE: 'CERTIFICATE',
    VISA: 'VISA',
    OTHER: 'OTHER',
  },
}));

import {
  EmployeeDocumentStatus,
  EmployeeDocumentType,
} from '@prisma/client';
import { EmployeeDocumentsService } from './employee-documents.service';

describe('EmployeeDocumentsService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn() };
  const presigner = {
    bucket: 'hr-documents',
    presign: jest.fn().mockReturnValue('https://signed.example.com'),
  };
  let prisma: any;
  let service: EmployeeDocumentsService;

  beforeEach(() => {
    prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }),
      },
      employeeDocument: {
        create: jest.fn().mockResolvedValue({
          id: 'document-1',
          employeeId: 'employee-1',
          type: EmployeeDocumentType.NIC,
          status: EmployeeDocumentStatus.PENDING_UPLOAD,
          fileName: 'nic.pdf',
          mimeType: 'application/pdf',
        }),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    jest.clearAllMocks();
    service = new EmployeeDocumentsService(
      prisma,
      presigner as any,
      audit as any,
      eventBus as any,
    );
  });

  it('creates metadata and returns a presigned upload URL without exposing object keys', async () => {
    const result = await service.createUploadUrl(
      'employee-1',
      {
        type: EmployeeDocumentType.NIC,
        fileName: 'nic.pdf',
        mimeType: 'application/pdf',
      },
      'company-1',
      'actor-1',
    );

    expect(prisma.employeeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          employeeId: 'employee-1',
          bucket: 'hr-documents',
        }),
      }),
    );
    expect(result.uploadUrl).toBe('https://signed.example.com');
    expect(result.document).not.toHaveProperty('objectKey');
  });

  it('returns a presigned download URL only for available company-scoped documents', async () => {
    prisma.employeeDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      employeeId: 'employee-1',
      type: EmployeeDocumentType.NIC,
      status: EmployeeDocumentStatus.AVAILABLE,
      fileName: 'nic.pdf',
      mimeType: 'application/pdf',
      objectKey: 'companies/company-1/employees/employee-1/documents/doc.pdf',
    });

    const result = await service.createDownloadUrl(
      'employee-1',
      'document-1',
      'company-1',
    );

    expect(prisma.employeeDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'document-1',
          employeeId: 'employee-1',
          companyId: 'company-1',
          status: EmployeeDocumentStatus.AVAILABLE,
        }),
      }),
    );
    expect(result.downloadUrl).toBe('https://signed.example.com');
    expect(result.document).not.toHaveProperty('objectKey');
  });
});
