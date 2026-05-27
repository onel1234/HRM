/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  EmployeeStatus: {
    ACTIVE: 'ACTIVE',
    ON_PROBATION: 'ON_PROBATION',
    INACTIVE: 'INACTIVE',
    SEPARATED: 'SEPARATED',
    TERMINATED: 'TERMINATED',
  },
  EmploymentType: {
    PERMANENT: 'PERMANENT',
    CONTRACT: 'CONTRACT',
    CASUAL: 'CASUAL',
  },
  ProbationStatus: {
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    IN_PROGRESS: 'IN_PROGRESS',
    EXTENDED: 'EXTENDED',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
  },
  UserRole: {
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    HR_MANAGER: 'HR_MANAGER',
    EMPLOYEE: 'EMPLOYEE',
  },
}));

import { BadRequestException } from '@nestjs/common';
import {
  EmployeeStatus,
  EmploymentType,
  ProbationStatus,
  UserRole,
} from '@prisma/client';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(4) };
  const notifications = { add: jest.fn().mockResolvedValue(undefined) };
  let prisma: any;
  let service: EmployeesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback) =>
        callback({
          user: {
            create: jest.fn().mockResolvedValue({ id: 'user-1' }),
          },
          employee: {
            create: jest.fn().mockResolvedValue({
              id: 'employee-1',
              employeeNo: 'E001',
              firstName: 'Nimali',
              lastName: 'Perera',
              employmentType: EmploymentType.PERMANENT,
              joinedAt: new Date('2026-01-01'),
              department: { id: 'department-1' },
              jobTitle: 'People Lead',
            }),
          },
        }),
      ),
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: 'department-1' }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    jest.clearAllMocks();
    service = new EmployeesService(
      prisma,
      config as any,
      audit as any,
      eventBus as any,
      notifications as any,
    );
  });

  it('normalizes Sri Lankan NIC values when creating employees', async () => {
    const txEmployeeCreate = jest.fn().mockResolvedValue({
      id: 'employee-1',
      employeeNo: 'E001',
      firstName: 'Nimali',
      lastName: 'Perera',
      employmentType: EmploymentType.PERMANENT,
      joinedAt: new Date('2026-01-01'),
      department: null,
      jobTitle: null,
    });
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        user: { create: jest.fn() },
        employee: { create: txEmployeeCreate },
      }),
    );

    await service.create(
      {
        firstName: 'Nimali',
        lastName: 'Perera',
        joinedAt: '2026-01-01',
        nicNumber: ' 123456789v ',
      },
      'company-1',
      'actor-1',
    );

    expect(txEmployeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nicNumber: '123456789V' }),
      }),
    );
  });

  it('rejects invalid Sri Lankan NIC formats', async () => {
    await expect(
      service.create(
        {
          firstName: 'Nimali',
          lastName: 'Perera',
          joinedAt: '2026-01-01',
          nicNumber: 'bad-nic',
        },
        'company-1',
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps employee listing tenant-scoped', async () => {
    await service.findAll('company-1', {
      status: EmployeeStatus.ACTIVE,
      probationStatus: ProbationStatus.CONFIRMED,
      search: 'perera',
    });

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
          probationStatus: ProbationStatus.CONFIRMED,
        }),
      }),
    );
  });

  it('prevents reporting hierarchy loops', async () => {
    prisma.employee.findFirst
      .mockResolvedValueOnce({
        id: 'employee-1',
        status: EmployeeStatus.ACTIVE,
        department: null,
        reportingManager: null,
      })
      .mockResolvedValueOnce({
        id: 'manager-1',
        reportingManagerId: 'employee-1',
      });

    await expect(
      service.update(
        'employee-1',
        { reportingManagerId: 'manager-1' },
        'company-1',
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a portal user when requested', async () => {
    const txUserCreate = jest.fn().mockResolvedValue({ id: 'user-1' });
    const txEmployeeCreate = jest.fn().mockResolvedValue({
      id: 'employee-1',
      employeeNo: null,
      firstName: 'Nimali',
      lastName: 'Perera',
      employmentType: EmploymentType.PERMANENT,
      joinedAt: new Date('2026-01-01'),
      department: null,
      jobTitle: null,
    });
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        user: { create: txUserCreate },
        employee: { create: txEmployeeCreate },
      }),
    );

    await service.create(
      {
        firstName: 'Nimali',
        lastName: 'Perera',
        joinedAt: '2026-01-01',
        portalUser: {
          email: 'nimali@example.com',
          password: 'StrongPass123',
          role: UserRole.EMPLOYEE,
        },
      },
      'company-1',
      'actor-1',
    );

    expect(txUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          email: 'nimali@example.com',
          role: UserRole.EMPLOYEE,
        }),
      }),
    );
    expect(txEmployeeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });
});
