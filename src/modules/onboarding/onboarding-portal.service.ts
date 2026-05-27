import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OnboardingPortalService {
  private readonly logger = new Logger(OnboardingPortalService.name);

  constructor(private prisma: PrismaService) {}

  /** Employee views their own onboarding */
  async getMyOnboarding(employeeId: string, companyId: string) {
    const instance = await this.prisma.onboardingInstance.findFirst({
      where: { employeeId, companyId },
      include: {
        checklist: true,
        taskInstances: { include: { task: true }, orderBy: { dueDate: 'asc' } },
        documentRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!instance) throw new NotFoundException('No onboarding found');

    const progress = this.calculateProgress(instance.taskInstances);
    return { ...instance, progress };
  }

  /** HR views all active onboarding instances */
  async findAllInstances(companyId: string, filters: { status?: OnboardingStatus; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { companyId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      this.prisma.onboardingInstance.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { employee: { select: { firstName: true, lastName: true, jobTitle: true } }, checklist: { select: { name: true } }, _count: { select: { taskInstances: true } } },
      }),
      this.prisma.onboardingInstance.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findInstance(id: string, companyId: string) {
    const inst = await this.prisma.onboardingInstance.findFirst({
      where: { id, companyId },
      include: {
        employee: { select: { firstName: true, lastName: true, jobTitle: true, workEmail: true } },
        checklist: true,
        taskInstances: { include: { task: true }, orderBy: { dueDate: 'asc' } },
        documentRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!inst) throw new NotFoundException('Onboarding instance not found');
    const progress = this.calculateProgress(inst.taskInstances);
    return { ...inst, progress };
  }

  async completeTask(taskInstanceId: string, companyId: string, evidence?: string) {
    const ti = await this.prisma.onboardingTaskInstance.findFirst({
      where: { id: taskInstanceId, companyId },
      include: { onboardingInstance: true },
    });
    if (!ti) throw new NotFoundException('Task not found');

    const updated = await this.prisma.onboardingTaskInstance.update({
      where: { id: taskInstanceId },
      data: { status: OnboardingTaskStatus.COMPLETED, completedAt: new Date(), evidence },
    });

    // Check if all tasks done → update instance status
    await this.updateInstanceStatus(ti.onboardingInstanceId);
    return updated;
  }

  async skipTask(taskInstanceId: string, companyId: string) {
    const ti = await this.prisma.onboardingTaskInstance.findFirst({
      where: { id: taskInstanceId, companyId },
    });
    if (!ti) throw new NotFoundException('Task not found');

    const updated = await this.prisma.onboardingTaskInstance.update({
      where: { id: taskInstanceId },
      data: { status: OnboardingTaskStatus.SKIPPED, skippedAt: new Date() },
    });

    await this.updateInstanceStatus(ti.onboardingInstanceId);
    return updated;
  }

  private async updateInstanceStatus(instanceId: string) {
    const tasks = await this.prisma.onboardingTaskInstance.findMany({
      where: { onboardingInstanceId: instanceId },
      include: { task: true },
    });

    const required = tasks.filter(t => t.task.required);
    const allDone = required.every(t => t.status === OnboardingTaskStatus.COMPLETED || t.status === OnboardingTaskStatus.SKIPPED);
    const anyStarted = tasks.some(t => t.status !== OnboardingTaskStatus.PENDING);

    let status: OnboardingStatus;
    if (allDone) status = OnboardingStatus.COMPLETED;
    else if (anyStarted) status = OnboardingStatus.IN_PROGRESS;
    else status = OnboardingStatus.NOT_STARTED;

    await this.prisma.onboardingInstance.update({
      where: { id: instanceId },
      data: { status, completedAt: allDone ? new Date() : null },
    });
  }

  private calculateProgress(taskInstances: Array<{ status: OnboardingTaskStatus }>) {
    if (taskInstances.length === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = taskInstances.filter(t => t.status === OnboardingTaskStatus.COMPLETED || t.status === OnboardingTaskStatus.SKIPPED).length;
    return { total: taskInstances.length, completed, percentage: Math.round((completed / taskInstances.length) * 100) };
  }
}
