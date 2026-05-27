import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.REPORTS },
      { name: QUEUES.NOTIFICATIONS },
    ),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsProcessor],
  exports: [ReportsService],
})
export class ReportsModule {}
