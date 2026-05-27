/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
  EmployeeStatus: {
    ACTIVE: 'ACTIVE',
    ON_PROBATION: 'ON_PROBATION',
    INACTIVE: 'INACTIVE',
  },
  ProbationReviewOutcome: {
    CONFIRMED: 'CONFIRMED',
    EXTENDED: 'EXTENDED',
    FAILED: 'FAILED',
    NEEDS_REVIEW: 'NEEDS_REVIEW',
  },
  ProbationStatus: {
    IN_PROGRESS: 'IN_PROGRESS',
    EXTENDED: 'EXTENDED',
    CONFIRMED: 'CONFIRMED',
    FAILED: 'FAILED',
  },
}));

import {
  EmployeeStatus,
  ProbationReviewOutcome,
  ProbationStatus,
} from '@prisma/client';
import { ProbationService } from './probation.service';

describe('ProbationService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const eventBus = { emit: jest.fn() };
  let prisma: any;
  let service: ProbationService;

  beforeEach(() => {
    prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'employee-1',
          probationStatus: ProbationStatus.IN_PROGRESS,
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({
          probationReview: {
            create: jest.fn().mockResolvedValue({ id: 'review-1' }),
          },
          employee: { update: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    jest.clearAllMocks();
    service = new ProbationService(prisma, audit as any, eventBus as any);
  });

  it('confirms probation and activates the employee', async () => {
    const txEmployeeUpdate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        probationReview: {
          create: jest.fn().mockResolvedValue({ id: 'review-1' }),
        },
        employee: { update: txEmployeeUpdate },
      }),
    );

    await service.createReview(
      'employee-1',
      { outcome: ProbationReviewOutcome.CONFIRMED },
      'company-1',
      'actor-1',
    );

    expect(txEmployeeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          probationStatus: ProbationStatus.CONFIRMED,
          status: EmployeeStatus.ACTIVE,
        }),
      }),
    );
  });
});
