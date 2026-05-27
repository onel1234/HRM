import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { NotificationProcessor } from './processors/notification.processor';
import { RecruitmentProcessor } from './processors/recruitment.processor';
import { QUEUES } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.NOTIFICATIONS },
      { name: QUEUES.RECRUITMENT },
    ),
  ],
  providers: [NotificationProcessor, RecruitmentProcessor],
  exports: [BullModule],
})
export class QueueModule {}
