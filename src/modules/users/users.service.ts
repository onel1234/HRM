import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, companyId: string, createdByUserId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
    });
    if (existing)
      throw new ConflictException('Email already exists in this company');

    const rounds = this.config.get<number>('app.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        phone: dto.phone,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await this.audit.log({
      companyId,
      userId: createdByUserId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });
    this.eventBus.emit('user.created', {
      userId: user.id,
      companyId,
      role: user.role,
    });

    return user;
  }

  async findAll(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { companyId } }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
