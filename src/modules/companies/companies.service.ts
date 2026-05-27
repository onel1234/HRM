import { Injectable, NotFoundException } from '@nestjs/common';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({ data: dto });
    this.eventBus.emit('company.created', { companyId: company.id });
    return company;
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, data: Partial<CreateCompanyDto>) {
    return this.prisma.company.update({ where: { id }, data });
  }
}
