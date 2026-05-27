/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private eventBus: EventBusService,
  ) {}

  async create(dto: CreateDepartmentDto, companyId: string, actorId: string) {
    await this.assertParent(companyId, dto.parentDepartmentId);
    await this.assertManager(companyId, dto.managerEmployeeId);

    try {
      const department = await this.prisma.department.create({
        data: {
          companyId,
          name: dto.name,
          code: dto.code,
          description: dto.description,
          parentDepartmentId: dto.parentDepartmentId,
          managerEmployeeId: dto.managerEmployeeId,
        },
      });

      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'department.created',
        entityType: 'Department',
        entityId: department.id,
        newValues: { name: department.name, code: department.code },
      });
      this.eventBus.emit('department.created', {
        companyId,
        departmentId: department.id,
      });

      return department;
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async findAll(companyId: string, includeInactive = false) {
    return this.prisma.department.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
        _count: { select: { employees: true, children: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
        employees: {
          where: { deletedAt: null },
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    companyId: string,
    actorId: string,
  ) {
    const current = await this.findOne(id, companyId);
    await this.assertParent(companyId, dto.parentDepartmentId, id);
    await this.assertManager(companyId, dto.managerEmployeeId);

    try {
      const department = await this.prisma.department.update({
        where: { id },
        data: {
          name: dto.name,
          code: dto.code,
          description: dto.description,
          parentDepartmentId: dto.parentDepartmentId,
          managerEmployeeId: dto.managerEmployeeId,
        },
      });

      await this.audit.log({
        companyId,
        userId: actorId,
        action: 'department.updated',
        entityType: 'Department',
        entityId: id,
        oldValues: {
          name: current.name,
          code: current.code,
          parentDepartmentId: current.parentDepartmentId,
          managerEmployeeId: current.managerEmployeeId,
        },
        newValues: {
          name: department.name,
          code: department.code,
          parentDepartmentId: department.parentDepartmentId,
          managerEmployeeId: department.managerEmployeeId,
        },
      });
      this.eventBus.emit('department.updated', { companyId, departmentId: id });

      return department;
    } catch (error) {
      this.handleUniqueError(error);
    }
  }

  async remove(id: string, companyId: string, actorId: string) {
    await this.findOne(id, companyId);
    const activeChildren = await this.prisma.department.count({
      where: { companyId, parentDepartmentId: id, deletedAt: null },
    });
    if (activeChildren > 0) {
      throw new BadRequestException(
        'Cannot deactivate a department with children',
      );
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await this.audit.log({
      companyId,
      userId: actorId,
      action: 'department.deactivated',
      entityType: 'Department',
      entityId: id,
    });
    this.eventBus.emit('department.deactivated', {
      companyId,
      departmentId: id,
    });
    return department;
  }

  private async assertParent(
    companyId: string,
    parentDepartmentId?: string,
    departmentId?: string,
  ) {
    if (!parentDepartmentId) return;
    if (parentDepartmentId === departmentId) {
      throw new BadRequestException('Department cannot be its own parent');
    }

    let cursor: string | null | undefined = parentDepartmentId;
    while (cursor) {
      const parent = await this.prisma.department.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { id: true, parentDepartmentId: true },
      });
      if (!parent)
        throw new BadRequestException('Parent department is invalid');
      if (parent.parentDepartmentId === departmentId) {
        throw new BadRequestException(
          'Department hierarchy cannot contain loops',
        );
      }
      cursor = parent.parentDepartmentId;
    }
  }

  private async assertManager(companyId: string, managerEmployeeId?: string) {
    if (!managerEmployeeId) return;
    const manager = await this.prisma.employee.findFirst({
      where: { id: managerEmployeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!manager) throw new BadRequestException('Manager employee is invalid');
  }

  private handleUniqueError(error: unknown): never {
    if (
      typeof error === 'object' &&
      error &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Department name or code already exists');
    }
    throw error;
  }
}
