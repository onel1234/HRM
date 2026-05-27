import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalibrationSessionStatus,
  FeedbackRequestStatus,
  PerformanceCadence,
  PerformanceCheckInStatus,
  PerformanceCycleStatus,
  PerformanceGoalScope,
  PerformanceGoalStatus,
  PerformanceReviewStatus,
  PipStatus,
  Prisma,
  SalaryIncrementStatus,
} from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import {
  CheckInQueryDto,
  CompleteCalibrationSessionDto,
  CompleteCheckInDto,
  CreateCalibrationSessionDto,
  CreateCheckInDto,
  CreateFeedbackRequestDto,
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  CreatePipDto,
  DecideSalaryIncrementDto,
  ListPerformanceQueryDto,
  ScheduleCheckInsDto,
  SubmitFeedbackDto,
  SubmitManagerReviewDto,
  SubmitSelfReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePipDto,
  UpdateReviewStatusDto,
  UpsertCalibrationItemDto,
  UpsertSalaryIncrementDto,
} from './dto/performance.dto';

@Injectable()
export class PerformanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async createCycle(
    companyId: string,
    actorId: string,
    dto: CreatePerformanceCycleDto,
  ) {
    const startDate = this.toDate(dto.startDate, 'Cycle start date is invalid');
    const endDate = this.toDate(dto.endDate, 'Cycle end date is invalid');
    this.assertDateOrder(
      startDate,
      endDate,
      'Cycle end date cannot be before start date',
    );
    this.assertRatingScale(dto.minRating, dto.maxRating);

    try {
      const cycle = await this.prisma.performanceCycle.create({
        data: {
          companyId,
          createdByUserId: actorId,
          name: dto.name,
          description: dto.description,
          type: dto.type,
          cadence: dto.cadence,
          startDate,
          midYearReviewDate: this.optionalDate(dto.midYearReviewDate),
          endDate,
          calibrationDueDate: this.optionalDate(dto.calibrationDueDate),
          minRating: dto.minRating,
          maxRating: dto.maxRating,
          salaryLinkEnabled: dto.salaryLinkEnabled ?? false,
        },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'performance.cycle.created',
        entityType: 'PerformanceCycle',
        entityId: cycle.id,
      });
      return cycle;
    } catch (error) {
      this.handleUniqueError(error, 'Performance cycle already exists');
    }
  }

  listCycles(companyId: string, status?: PerformanceCycleStatus) {
    return this.prisma.performanceCycle.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: {
        goals: { select: { id: true } },
        reviews: { select: { id: true, status: true } },
        calibrationSessions: { select: { id: true, status: true } },
      },
      orderBy: [{ startDate: 'desc' }],
    });
  }

  async updateCycle(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdatePerformanceCycleDto,
  ) {
    const current = await this.assertCycle(companyId, id);
    const startDate = this.optionalDate(dto.startDate) ?? current.startDate;
    const endDate = this.optionalDate(dto.endDate) ?? current.endDate;
    this.assertDateOrder(
      startDate,
      endDate,
      'Cycle end date cannot be before start date',
    );
    this.assertRatingScale(
      dto.minRating ?? current.minRating,
      dto.maxRating ?? current.maxRating,
    );

    const cycle = await this.prisma.performanceCycle.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        cadence: dto.cadence,
        status: dto.status,
        startDate: dto.startDate ? startDate : undefined,
        midYearReviewDate: this.optionalDate(dto.midYearReviewDate),
        endDate: dto.endDate ? endDate : undefined,
        calibrationDueDate: this.optionalDate(dto.calibrationDueDate),
        minRating: dto.minRating,
        maxRating: dto.maxRating,
        salaryLinkEnabled: dto.salaryLinkEnabled,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.cycle.updated',
      entityType: 'PerformanceCycle',
      entityId: id,
    });
    return cycle;
  }

  async createGoal(
    companyId: string,
    actorId: string,
    dto: CreatePerformanceGoalDto,
  ) {
    await this.assertCycle(companyId, dto.cycleId);
    if (dto.scope === PerformanceGoalScope.TEAM || dto.departmentId) {
      if (!dto.departmentId) {
        throw new BadRequestException('Team goals require a department');
      }
      await this.assertDepartment(companyId, dto.departmentId);
    }
    if (dto.scope !== PerformanceGoalScope.TEAM || dto.employeeId) {
      if (!dto.employeeId && !dto.departmentId) {
        throw new BadRequestException(
          'Goal requires an employee or department owner',
        );
      }
    }
    if (dto.employeeId) await this.assertEmployee(companyId, dto.employeeId);
    if (dto.parentGoalId) await this.assertGoal(companyId, dto.parentGoalId);

    const progress = this.progressFromValues(dto.currentValue, dto.targetValue);
    const goal = await this.prisma.performanceGoal.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        departmentId: dto.departmentId,
        parentGoalId: dto.parentGoalId,
        createdByUserId: actorId,
        type: dto.type,
        scope:
          dto.scope ??
          (dto.departmentId ? PerformanceGoalScope.TEAM : undefined),
        title: dto.title,
        description: dto.description,
        metricName: dto.metricName,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        unit: dto.unit,
        weight: dto.weight,
        progress,
        dueDate: this.optionalDate(dto.dueDate),
        status: PerformanceGoalStatus.ACTIVE,
      },
      include: { employee: true, department: true, cycle: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.goal.created',
      entityType: 'PerformanceGoal',
      entityId: goal.id,
    });
    return goal;
  }

  listGoals(companyId: string, filters: ListPerformanceQueryDto) {
    return this.prisma.performanceGoal.findMany({
      where: {
        companyId,
        ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.status
          ? { status: filters.status as PerformanceGoalStatus }
          : {}),
      },
      include: {
        cycle: true,
        employee: true,
        department: true,
        checkIns: { orderBy: { dueDate: 'asc' } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listMyGoals(companyId: string, userId: string, cycleId?: string) {
    const employee = await this.employeeForUser(companyId, userId);
    return this.listGoals(companyId, { employeeId: employee.id, cycleId });
  }

  async updateGoal(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdatePerformanceGoalDto,
  ) {
    const current = await this.assertGoal(companyId, id);
    if (dto.employeeId) await this.assertEmployee(companyId, dto.employeeId);
    if (dto.departmentId)
      await this.assertDepartment(companyId, dto.departmentId);
    const progress =
      dto.progress ??
      this.progressFromValues(
        dto.currentValue,
        dto.targetValue ?? this.decimalToNumber(current.targetValue),
      );
    const goal = await this.prisma.performanceGoal.update({
      where: { id },
      data: {
        employeeId: dto.employeeId,
        departmentId: dto.departmentId,
        parentGoalId: dto.parentGoalId,
        type: dto.type,
        scope: dto.scope,
        status: dto.status,
        title: dto.title,
        description: dto.description,
        metricName: dto.metricName,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        unit: dto.unit,
        weight: dto.weight,
        progress,
        dueDate: this.optionalDate(dto.dueDate),
      },
      include: {
        employee: true,
        department: true,
        cycle: true,
        checkIns: true,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.goal.updated',
      entityType: 'PerformanceGoal',
      entityId: id,
    });
    return goal;
  }

  async scheduleCheckIns(
    companyId: string,
    actorId: string,
    cycleId: string,
    dto: ScheduleCheckInsDto,
  ) {
    const cycle = await this.assertCycle(companyId, cycleId);
    const goals = await this.prisma.performanceGoal.findMany({
      where: {
        companyId,
        cycleId,
        status: { not: PerformanceGoalStatus.CANCELLED },
        ...(dto.goalId ? { id: dto.goalId } : {}),
      },
      include: { department: true },
    });
    const dueDates = this.cadenceDates(
      cycle.startDate,
      cycle.endDate,
      cycle.cadence,
    );
    let created = 0;

    for (const goal of goals) {
      const employeeIds = goal.employeeId
        ? [goal.employeeId]
        : await this.employeeIdsForDepartment(companyId, goal.departmentId);
      if (!employeeIds.length) continue;
      const data = employeeIds.flatMap((employeeId) =>
        dueDates.map((dueDate) => ({
          companyId,
          goalId: goal.id,
          employeeId,
          dueDate,
        })),
      );
      if (!data.length) continue;
      const result = await this.prisma.performanceCheckIn.createMany({
        data,
        skipDuplicates: true,
      });
      created += result.count;
    }

    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.check_ins.scheduled',
      entityType: 'PerformanceCycle',
      entityId: cycleId,
      metadata: { created, cadence: cycle.cadence },
    });
    return { created, cadence: cycle.cadence };
  }

  async createCheckIn(
    companyId: string,
    actorId: string,
    dto: CreateCheckInDto,
  ) {
    await this.assertGoal(companyId, dto.goalId);
    await this.assertEmployee(companyId, dto.employeeId);
    const checkIn = await this.prisma.performanceCheckIn.create({
      data: {
        companyId,
        goalId: dto.goalId,
        employeeId: dto.employeeId,
        managerUserId: dto.managerUserId,
        dueDate: this.toDate(dto.dueDate, 'Check-in due date is invalid'),
      },
      include: { goal: true, employee: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.check_in.created',
      entityType: 'PerformanceCheckIn',
      entityId: checkIn.id,
    });
    return checkIn;
  }

  listCheckIns(companyId: string, filters: CheckInQueryDto) {
    return this.prisma.performanceCheckIn.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.checkInStatus ? { status: filters.checkInStatus } : {}),
        ...(filters.cycleId ? { goal: { cycleId: filters.cycleId } } : {}),
      },
      include: { goal: true, employee: true, manager: true },
      orderBy: [{ dueDate: 'asc' }],
    });
  }

  async completeCheckIn(
    companyId: string,
    actorId: string,
    id: string,
    dto: CompleteCheckInDto,
  ) {
    const current = await this.prisma.performanceCheckIn.findFirst({
      where: { companyId, id },
      include: { goal: true },
    });
    if (!current) throw new NotFoundException('Check-in not found');
    const actorEmployee = await this.prisma.employee.findFirst({
      where: { companyId, userId: actorId, deletedAt: null },
      select: { id: true },
    });
    if (
      current.employeeId !== actorEmployee?.id &&
      current.managerUserId !== actorId
    ) {
      throw new ForbiddenException('You can only complete assigned check-ins');
    }

    const checkIn = await this.prisma.performanceCheckIn.update({
      where: { id },
      data: {
        status: PerformanceCheckInStatus.COMPLETED,
        completedAt: new Date(),
        progressUpdate: dto.progressUpdate,
        confidenceScore: dto.confidenceScore,
        notes: dto.notes,
        blockers: dto.blockers,
        nextSteps: dto.nextSteps,
      },
      include: { goal: true, employee: true, manager: true },
    });
    if (dto.progressUpdate != null) {
      await this.prisma.performanceGoal.update({
        where: { id: current.goalId },
        data: {
          progress: dto.progressUpdate,
          currentValue: current.goal.targetValue
            ? (this.decimalToNumber(current.goal.targetValue) *
                dto.progressUpdate) /
              100
            : undefined,
          status:
            dto.progressUpdate >= 100
              ? PerformanceGoalStatus.COMPLETED
              : current.goal.status,
        },
      });
    }
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.check_in.completed',
      entityType: 'PerformanceCheckIn',
      entityId: id,
    });
    return checkIn;
  }

  async requestFeedback(
    companyId: string,
    actorId: string,
    dto: CreateFeedbackRequestDto,
  ) {
    await this.assertCycle(companyId, dto.cycleId);
    await this.assertEmployee(companyId, dto.subjectEmployeeId);
    if (dto.reviewId) await this.assertReview(companyId, dto.reviewId);
    try {
      const request = await this.prisma.feedbackRequest.create({
        data: {
          companyId,
          cycleId: dto.cycleId,
          reviewId: dto.reviewId,
          subjectEmployeeId: dto.subjectEmployeeId,
          reviewerUserId: dto.reviewerUserId,
          requestedByUserId: actorId,
          relationship: dto.relationship,
          dueDate: this.optionalDate(dto.dueDate),
        },
        include: { subjectEmployee: true, reviewer: true, cycle: true },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'performance.feedback.requested',
        entityType: 'FeedbackRequest',
        entityId: request.id,
      });
      return request;
    } catch (error) {
      this.handleUniqueError(
        error,
        'Feedback has already been requested from this reviewer',
      );
    }
  }

  async requestBulkFeedback(
    companyId: string,
    actorId: string,
    requests: CreateFeedbackRequestDto[],
  ) {
    const created: unknown[] = [];
    for (const request of requests) {
      created.push(await this.requestFeedback(companyId, actorId, request));
    }
    return { created: created.length, requests: created };
  }

  listFeedback(companyId: string, filters: ListPerformanceQueryDto) {
    return this.prisma.feedbackRequest.findMany({
      where: {
        companyId,
        ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
        ...(filters.employeeId
          ? { subjectEmployeeId: filters.employeeId }
          : {}),
        ...(filters.status
          ? { status: filters.status as FeedbackRequestStatus }
          : {}),
      },
      include: {
        cycle: true,
        subjectEmployee: true,
        reviewer: true,
        requestedBy: true,
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listMyFeedbackRequests(companyId: string, userId: string) {
    return this.prisma.feedbackRequest.findMany({
      where: { companyId, reviewerUserId: userId },
      include: { cycle: true, subjectEmployee: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async submitFeedback(
    companyId: string,
    userId: string,
    id: string,
    dto: SubmitFeedbackDto,
  ) {
    const current = await this.prisma.feedbackRequest.findFirst({
      where: { companyId, id, reviewerUserId: userId },
    });
    if (!current) throw new NotFoundException('Feedback request not found');
    const declined = dto.status === FeedbackRequestStatus.DECLINED;
    const request = await this.prisma.feedbackRequest.update({
      where: { id },
      data: {
        status: declined
          ? FeedbackRequestStatus.DECLINED
          : FeedbackRequestStatus.SUBMITTED,
        submittedAt: declined ? undefined : new Date(),
        strengths: dto.strengths,
        improvements: dto.improvements,
        valuesRating: dto.valuesRating,
        performanceRating: dto.performanceRating,
        comments: dto.comments,
      },
    });
    await this.audit.log({
      companyId,
      userId,
      action: declined
        ? 'performance.feedback.declined'
        : 'performance.feedback.submitted',
      entityType: 'FeedbackRequest',
      entityId: id,
    });
    return request;
  }

  async createReview(
    companyId: string,
    actorId: string,
    dto: CreatePerformanceReviewDto,
  ) {
    await this.assertCycle(companyId, dto.cycleId);
    await this.assertEmployee(companyId, dto.employeeId);
    try {
      const review = await this.prisma.performanceReview.create({
        data: {
          companyId,
          cycleId: dto.cycleId,
          employeeId: dto.employeeId,
          managerUserId: dto.managerUserId,
          status: PerformanceReviewStatus.SELF_REVIEW,
        },
        include: { cycle: true, employee: true, manager: true },
      });
      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'performance.review.created',
        entityType: 'PerformanceReview',
        entityId: review.id,
      });
      return review;
    } catch (error) {
      this.handleUniqueError(
        error,
        'Review already exists for this employee and cycle',
      );
    }
  }

  listReviews(companyId: string, filters: ListPerformanceQueryDto) {
    return this.prisma.performanceReview.findMany({
      where: {
        companyId,
        ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status
          ? { status: filters.status as PerformanceReviewStatus }
          : {}),
      },
      include: {
        cycle: true,
        employee: true,
        manager: true,
        feedbackRequests: true,
        calibrationItems: true,
        salaryIncrementRecommendation: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async submitSelfReview(
    companyId: string,
    userId: string,
    id: string,
    dto: SubmitSelfReviewDto,
  ) {
    const employee = await this.employeeForUser(companyId, userId);
    const review = await this.prisma.performanceReview.findFirst({
      where: { companyId, id, employeeId: employee.id },
      include: { cycle: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    this.assertRatingInCycle(review.cycle, dto.selfRating);
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        selfRating: dto.selfRating,
        selfSummary: dto.selfSummary,
        status: PerformanceReviewStatus.MANAGER_REVIEW,
      },
    });
    await this.audit.log({
      companyId,
      userId,
      action: 'performance.review.self_submitted',
      entityType: 'PerformanceReview',
      entityId: id,
    });
    return updated;
  }

  async submitManagerReview(
    companyId: string,
    actorId: string,
    id: string,
    dto: SubmitManagerReviewDto,
  ) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { companyId, id },
      include: { cycle: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    this.assertRatingInCycle(review.cycle, dto.managerRating);
    const updated = await this.prisma.performanceReview.update({
      where: { id },
      data: {
        managerUserId: actorId,
        managerRating: dto.managerRating,
        managerSummary: dto.managerSummary,
        finalRating: dto.managerRating,
        status: PerformanceReviewStatus.CALIBRATION_READY,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.review.manager_submitted',
      entityType: 'PerformanceReview',
      entityId: id,
    });
    return updated;
  }

  async updateReviewStatus(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdateReviewStatusDto,
  ) {
    await this.assertReview(companyId, id);
    const data: Prisma.PerformanceReviewUpdateInput = {
      status: dto.status,
      finalizedAt:
        dto.status === PerformanceReviewStatus.FINALIZED
          ? new Date()
          : undefined,
      acknowledgedAt:
        dto.status === PerformanceReviewStatus.ACKNOWLEDGED
          ? new Date()
          : undefined,
    };
    const review = await this.prisma.performanceReview.update({
      where: { id },
      data,
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.review.status_updated',
      entityType: 'PerformanceReview',
      entityId: id,
      metadata: { status: dto.status },
    });
    return review;
  }

  async createCalibrationSession(
    companyId: string,
    actorId: string,
    dto: CreateCalibrationSessionDto,
  ) {
    await this.assertCycle(companyId, dto.cycleId);
    const session = await this.prisma.calibrationSession.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        facilitatorUserId: actorId,
        name: dto.name,
        scheduledAt: this.optionalDate(dto.scheduledAt),
        notes: dto.notes,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.calibration_session.created',
      entityType: 'CalibrationSession',
      entityId: session.id,
    });
    return session;
  }

  listCalibrationSessions(companyId: string, cycleId?: string) {
    return this.prisma.calibrationSession.findMany({
      where: { companyId, ...(cycleId ? { cycleId } : {}) },
      include: {
        cycle: true,
        facilitator: true,
        items: { include: { review: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async upsertCalibrationItem(
    companyId: string,
    actorId: string,
    sessionId: string,
    dto: UpsertCalibrationItemDto,
  ) {
    const session = await this.prisma.calibrationSession.findFirst({
      where: { companyId, id: sessionId },
    });
    if (!session) throw new NotFoundException('Calibration session not found');
    const review = await this.prisma.performanceReview.findFirst({
      where: { companyId, id: dto.reviewId, cycleId: session.cycleId },
      include: { cycle: true },
    });
    if (!review)
      throw new BadRequestException('Review is invalid for this session');
    if (dto.calibratedRating != null)
      this.assertRatingInCycle(review.cycle, dto.calibratedRating);

    const item = await this.prisma.calibrationItem.upsert({
      where: { sessionId_reviewId: { sessionId, reviewId: dto.reviewId } },
      create: {
        companyId,
        sessionId,
        reviewId: dto.reviewId,
        proposedRating: dto.proposedRating,
        calibratedRating: dto.calibratedRating,
        rationale: dto.rationale,
        salaryIncrementPercent: dto.salaryIncrementPercent,
        incrementAmount: dto.incrementAmount,
      },
      update: {
        proposedRating: dto.proposedRating,
        calibratedRating: dto.calibratedRating,
        rationale: dto.rationale,
        salaryIncrementPercent: dto.salaryIncrementPercent,
        incrementAmount: dto.incrementAmount,
      },
      include: { review: true },
    });
    if (dto.calibratedRating != null) {
      await this.prisma.performanceReview.update({
        where: { id: dto.reviewId },
        data: {
          calibratedRating: dto.calibratedRating,
          finalRating: dto.calibratedRating,
          calibrationNotes: dto.rationale,
          status: PerformanceReviewStatus.CALIBRATED,
        },
      });
    }
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.calibration_item.upserted',
      entityType: 'CalibrationItem',
      entityId: item.id,
    });
    return item;
  }

  async completeCalibrationSession(
    companyId: string,
    actorId: string,
    sessionId: string,
    dto: CompleteCalibrationSessionDto,
  ) {
    const session = await this.prisma.calibrationSession.findFirst({
      where: { companyId, id: sessionId },
    });
    if (!session) throw new NotFoundException('Calibration session not found');
    const status = dto.status ?? CalibrationSessionStatus.COMPLETED;
    const updated = await this.prisma.calibrationSession.update({
      where: { id: sessionId },
      data: {
        status,
        completedAt:
          status === CalibrationSessionStatus.COMPLETED
            ? new Date()
            : undefined,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.calibration_session.updated',
      entityType: 'CalibrationSession',
      entityId: sessionId,
      metadata: { status },
    });
    return updated;
  }

  async upsertSalaryIncrement(
    companyId: string,
    actorId: string,
    dto: UpsertSalaryIncrementDto,
  ) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { companyId, id: dto.reviewId },
      include: { employee: { include: { salaryProfile: true } }, cycle: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (!review.cycle.salaryLinkEnabled) {
      throw new BadRequestException(
        'Salary linkage is not enabled for this cycle',
      );
    }
    const salaryProfile = review.employee.salaryProfile;
    const currentSalary = this.decimalToNumber(salaryProfile?.basicSalary);
    const recommendedAmount =
      dto.recommendedAmount ??
      (dto.recommendedPercent != null
        ? this.money((currentSalary * dto.recommendedPercent) / 100)
        : undefined);
    const recommendation =
      await this.prisma.salaryIncrementRecommendation.upsert({
        where: { reviewId: dto.reviewId },
        create: {
          companyId,
          cycleId: review.cycleId,
          reviewId: review.id,
          employeeId: review.employeeId,
          salaryProfileId: salaryProfile?.id,
          currentSalary: currentSalary || undefined,
          recommendedPercent: dto.recommendedPercent,
          recommendedAmount,
          effectiveDate: this.optionalDate(dto.effectiveDate),
          rationale: dto.rationale,
        },
        update: {
          salaryProfileId: salaryProfile?.id,
          currentSalary: currentSalary || undefined,
          recommendedPercent: dto.recommendedPercent,
          recommendedAmount,
          effectiveDate: this.optionalDate(dto.effectiveDate),
          rationale: dto.rationale,
          status: SalaryIncrementStatus.PROPOSED,
        },
      });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.salary_increment.upserted',
      entityType: 'SalaryIncrementRecommendation',
      entityId: recommendation.id,
    });
    return recommendation;
  }

  listSalaryIncrements(companyId: string, filters: ListPerformanceQueryDto) {
    return this.prisma.salaryIncrementRecommendation.findMany({
      where: {
        companyId,
        ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status
          ? { status: filters.status as SalaryIncrementStatus }
          : {}),
      },
      include: {
        cycle: true,
        review: true,
        employee: true,
        salaryProfile: true,
        approvedBy: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async decideSalaryIncrement(
    companyId: string,
    actorId: string,
    id: string,
    dto: DecideSalaryIncrementDto,
  ) {
    const current = await this.prisma.salaryIncrementRecommendation.findFirst({
      where: { companyId, id },
    });
    if (!current)
      throw new NotFoundException('Salary increment recommendation not found');
    const approvedAmount =
      dto.approvedAmount ??
      (dto.approvedPercent != null && current.currentSalary
        ? this.money(
            (this.decimalToNumber(current.currentSalary) *
              dto.approvedPercent) /
              100,
          )
        : undefined);
    const updated = await this.prisma.salaryIncrementRecommendation.update({
      where: { id },
      data: {
        status: dto.status,
        approvedPercent: dto.approvedPercent,
        approvedAmount,
        approvedByUserId:
          dto.status === SalaryIncrementStatus.APPROVED ? actorId : undefined,
        approvedAt:
          dto.status === SalaryIncrementStatus.APPROVED
            ? new Date()
            : undefined,
      },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.salary_increment.decided',
      entityType: 'SalaryIncrementRecommendation',
      entityId: id,
      metadata: { status: dto.status },
    });
    return updated;
  }

  async createPip(companyId: string, actorId: string, dto: CreatePipDto) {
    await this.assertEmployee(companyId, dto.employeeId);
    if (dto.cycleId) await this.assertCycle(companyId, dto.cycleId);
    if (dto.reviewId) await this.assertReview(companyId, dto.reviewId);
    const startDate = this.toDate(dto.startDate, 'PIP start date is invalid');
    const endDate = this.toDate(dto.endDate, 'PIP end date is invalid');
    this.assertDateOrder(
      startDate,
      endDate,
      'PIP end date cannot be before start date',
    );
    const pip = await this.prisma.performanceImprovementPlan.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        managerUserId: dto.managerUserId,
        reviewId: dto.reviewId,
        reason: dto.reason,
        startDate,
        endDate,
        successCriteria: dto.successCriteria,
        supportPlan: dto.supportPlan,
        checkpoints: dto.checkpoints as Prisma.InputJsonValue,
        status: PipStatus.ACTIVE,
      },
      include: { employee: true, manager: true, review: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.pip.created',
      entityType: 'PerformanceImprovementPlan',
      entityId: pip.id,
    });
    return pip;
  }

  listPips(companyId: string, filters: ListPerformanceQueryDto) {
    return this.prisma.performanceImprovementPlan.findMany({
      where: {
        companyId,
        ...(filters.cycleId ? { cycleId: filters.cycleId } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status as PipStatus } : {}),
      },
      include: { cycle: true, employee: true, manager: true, review: true },
      orderBy: [{ endDate: 'asc' }],
    });
  }

  async updatePip(
    companyId: string,
    actorId: string,
    id: string,
    dto: UpdatePipDto,
  ) {
    const current = await this.prisma.performanceImprovementPlan.findFirst({
      where: { companyId, id },
    });
    if (!current) throw new NotFoundException('PIP not found');
    const startDate = this.optionalDate(dto.startDate) ?? current.startDate;
    const endDate = this.optionalDate(dto.endDate) ?? current.endDate;
    this.assertDateOrder(
      startDate,
      endDate,
      'PIP end date cannot be before start date',
    );
    const closed =
      dto.status === PipStatus.COMPLETED_SUCCESSFUL ||
      dto.status === PipStatus.COMPLETED_UNSUCCESSFUL ||
      dto.status === PipStatus.CANCELLED;
    const pip = await this.prisma.performanceImprovementPlan.update({
      where: { id },
      data: {
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        managerUserId: dto.managerUserId,
        reviewId: dto.reviewId,
        status: dto.status,
        reason: dto.reason,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate ? endDate : undefined,
        successCriteria: dto.successCriteria,
        supportPlan: dto.supportPlan,
        checkpoints: dto.checkpoints as Prisma.InputJsonValue,
        outcomeNotes: dto.outcomeNotes,
        closedAt: closed ? new Date() : undefined,
      },
      include: { cycle: true, employee: true, manager: true, review: true },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'performance.pip.updated',
      entityType: 'PerformanceImprovementPlan',
      entityId: id,
    });
    return pip;
  }

  private async assertCycle(companyId: string, id: string) {
    const cycle = await this.prisma.performanceCycle.findFirst({
      where: { companyId, id },
    });
    if (!cycle) throw new NotFoundException('Performance cycle not found');
    return cycle;
  }

  private async assertGoal(companyId: string, id: string) {
    const goal = await this.prisma.performanceGoal.findFirst({
      where: { companyId, id },
    });
    if (!goal) throw new NotFoundException('Performance goal not found');
    return goal;
  }

  private async assertReview(companyId: string, id: string) {
    const review = await this.prisma.performanceReview.findFirst({
      where: { companyId, id },
    });
    if (!review) throw new NotFoundException('Performance review not found');
    return review;
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, id: employeeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new BadRequestException('Employee is invalid');
    return employee;
  }

  private async assertDepartment(companyId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { companyId, id: departmentId, deletedAt: null },
      select: { id: true },
    });
    if (!department) throw new BadRequestException('Department is invalid');
    return department;
  }

  private async employeeForUser(companyId: string, userId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!employee)
      throw new BadRequestException('User is not linked to an employee');
    return employee;
  }

  private async employeeIdsForDepartment(
    companyId: string,
    departmentId?: string | null,
  ) {
    if (!departmentId) return [];
    const employees = await this.prisma.employee.findMany({
      where: { companyId, departmentId, deletedAt: null },
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }

  private assertRatingScale(minRating?: number, maxRating?: number) {
    if (minRating != null && maxRating != null && minRating >= maxRating) {
      throw new BadRequestException(
        'Maximum rating must be greater than minimum rating',
      );
    }
  }

  private assertRatingInCycle(
    cycle: { minRating: number; maxRating: number },
    rating: number,
  ) {
    if (rating < cycle.minRating || rating > cycle.maxRating) {
      throw new BadRequestException(
        `Rating must be between ${cycle.minRating} and ${cycle.maxRating}`,
      );
    }
  }

  private assertDateOrder(startDate: Date, endDate: Date, message: string) {
    if (endDate < startDate) throw new BadRequestException(message);
  }

  private cadenceDates(
    startDate: Date,
    endDate: Date,
    cadence: PerformanceCadence,
  ) {
    const months = cadence === PerformanceCadence.MONTHLY ? 1 : 3;
    const dates: Date[] = [];
    const cursor = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
      ),
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + months);
    while (cursor <= endDate) {
      dates.push(new Date(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + months);
    }
    if (
      !dates.length ||
      dates[dates.length - 1].getTime() !== endDate.getTime()
    ) {
      dates.push(new Date(endDate));
    }
    return dates;
  }

  private progressFromValues(
    currentValue?: number | null,
    targetValue?: number | null,
  ) {
    if (currentValue == null || targetValue == null || targetValue <= 0)
      return undefined;
    return Math.min(100, this.money((currentValue / targetValue) * 100));
  }

  private optionalDate(value?: string | null) {
    if (!value) return undefined;
    return this.toDate(value, 'Date is invalid');
  }

  private toDate(value: string, message: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(message);
    return date;
  }

  private decimalToNumber(value: unknown) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber: () => number }).toNumber();
    }
    return Number(value);
  }

  private money(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  private handleUniqueError(error: unknown, message: string): never {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
