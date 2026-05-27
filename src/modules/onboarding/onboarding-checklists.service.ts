import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';

@Injectable()
export class OnboardingChecklistsService {
  private readonly logger = new Logger(OnboardingChecklistsService.name);

  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreateChecklistDto, companyId: string, userId: string) {
    const checklist = await this.prisma.$transaction(async (tx) => {
      const cl = await tx.onboardingChecklist.create({
        data: { companyId, name: dto.name, description: dto.description, departmentId: dto.departmentId, jobTitle: dto.jobTitle },
      });

      for (let i = 0; i < dto.tasks.length; i++) {
        const t = dto.tasks[i];
        await tx.onboardingTask.create({
          data: { companyId, checklistId: cl.id, title: t.title, description: t.description, type: t.type, assigneeRole: t.assigneeRole, dueDaysFromStart: t.dueDaysFromStart || 7, required: t.required ?? true, sortOrder: t.sortOrder ?? i },
        });
      }

      return tx.onboardingChecklist.findUniqueOrThrow({ where: { id: cl.id }, include: { tasks: { orderBy: { sortOrder: 'asc' } } } });
    });

    void this.audit.log({ companyId, userId, action: 'onboarding_checklist.created', entityType: 'OnboardingChecklist', entityId: checklist.id });
    return checklist;
  }

  async findAll(companyId: string) {
    return this.prisma.onboardingChecklist.findMany({
      where: { companyId, isActive: true },
      include: { tasks: { orderBy: { sortOrder: 'asc' } }, _count: { select: { instances: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const cl = await this.prisma.onboardingChecklist.findFirst({
      where: { id, companyId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } }, instances: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    });
    if (!cl) throw new NotFoundException('Checklist not found');
    return cl;
  }

  async assignToEmployee(checklistId: string, employeeId: string, companyId: string, startDate: Date, userId: string) {
    const checklist = await this.prisma.onboardingChecklist.findFirst({
      where: { id: checklistId, companyId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!checklist) throw new NotFoundException('Checklist not found');

    const instance = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.onboardingInstance.create({
        data: { companyId, checklistId, employeeId, startDate, status: OnboardingStatus.NOT_STARTED, dueDate: new Date(startDate.getTime() + 30 * 86400000) },
      });

      for (const task of checklist.tasks) {
        const dueDate = new Date(startDate.getTime() + task.dueDaysFromStart * 86400000);
        await tx.onboardingTaskInstance.create({
          data: { companyId, onboardingInstanceId: inst.id, taskId: task.id, status: OnboardingTaskStatus.PENDING, dueDate },
        });
      }

      return tx.onboardingInstance.findUniqueOrThrow({
        where: { id: inst.id },
        include: { taskInstances: { include: { task: true }, orderBy: { dueDate: 'asc' } }, checklist: true, employee: { select: { firstName: true, lastName: true } } },
      });
    });

    void this.audit.log({ companyId, userId, action: 'onboarding.assigned', entityType: 'OnboardingInstance', entityId: instance.id });
    return instance;
  }

  /** Auto-assign onboarding when offer is accepted */
  @OnEvent('offer.accepted')
  async handleOfferAccepted(payload: { companyId: string; employeeId: string; offerId: string }) {
    this.logger.log(`Auto-assigning onboarding for employee ${payload.employeeId}`);

    const defaultChecklist = await this.prisma.onboardingChecklist.findFirst({
      where: { companyId: payload.companyId, isDefault: true, isActive: true },
    });
    if (!defaultChecklist) {
      this.logger.warn('No default onboarding checklist found — skipping auto-assign');
      return;
    }

    await this.assignToEmployee(defaultChecklist.id, payload.employeeId, payload.companyId, new Date(), 'system');
  }
}
