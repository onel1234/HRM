/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  EmployeeStatus: {
    ACTIVE: 'ACTIVE',
    SEPARATED: 'SEPARATED',
    TERMINATED: 'TERMINATED',
  },
  SeparationStatus: {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
  },
  SeparationType: {
    RESIGNATION: 'RESIGNATION',
    TERMINATION: 'TERMINATION',
  },
  UserStatus: {
    INACTIVE: 'INACTIVE',
  },
}));

import {
  EmployeeStatus,
  SeparationStatus,
  SeparationType,
  UserStatus,
} from '@prisma/client';
import { SeparationService } from './separation.service';

describe('SeparationService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn() };
  let prisma: any;
  let service: SeparationService;

  beforeEach(() => {
    prisma = {
      separationRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'separation-1',
          companyId: 'company-1',
          employeeId: 'employee-1',
          approvedByUserId: 'actor-1',
          status: SeparationStatus.APPROVED,
          type: SeparationType.TERMINATION,
          reason: 'Policy violation',
          notes: null,
          approvedAt: new Date('2026-01-01'),
          completedAt: null,
          effectiveDate: new Date('2026-01-31'),
          employee: { id: 'employee-1', userId: 'user-1' },
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({
          separationRequest: {
            update: jest.fn().mockResolvedValue({ id: 'separation-1' }),
          },
          employee: { update: jest.fn().mockResolvedValue({}) },
          user: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    jest.clearAllMocks();
    service = new SeparationService(prisma, audit as any, eventBus as any);
  });

  it('completes approved termination and deactivates linked user access', async () => {
    const txEmployeeUpdate = jest.fn().mockResolvedValue({});
    const txUserUpdate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        separationRequest: {
          update: jest.fn().mockResolvedValue({ id: 'separation-1' }),
        },
        employee: { update: txEmployeeUpdate },
        user: { update: txUserUpdate },
      }),
    );

    await service.update(
      'separation-1',
      { status: SeparationStatus.COMPLETED },
      'company-1',
      'actor-2',
    );

    expect(txEmployeeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmployeeStatus.TERMINATED,
        }),
      }),
    );
    expect(txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { status: UserStatus.INACTIVE, refreshTokenHash: null },
      }),
    );
  });
});
