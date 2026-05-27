import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    if (process.env.NODE_ENV === 'development') {
      // Prisma 7 generated clients with driver adapters do not expose typed query events yet.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this as any).$on(
        'query',
        (event: { duration: number; query: string }) => {
          if (event.duration > 200) {
            this.logger.warn(
              `Slow query (${event.duration}ms): ${event.query}`,
            );
          }
        },
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  softDelete(model: string, id: string): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
