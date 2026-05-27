import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { QUEUES } from '../../queue/queue.constants';
import type { NotificationJob } from '../../queue/processors/notification.processor';
import type { ReportEmailJob } from './reports.service';
import { ReportsService } from './reports.service';

@Processor(QUEUES.REPORTS)
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private reports: ReportsService,
    @InjectQueue(QUEUES.NOTIFICATIONS)
    private notifications: Queue<NotificationJob>,
  ) {}

  @Process('email-report')
  async emailReport(job: Job<ReportEmailJob>) {
    const report = await this.reports.runConfiguredReport(job.data);
    await Promise.all(
      job.data.to.map((recipient) =>
        this.notifications.add(
          'send',
          {
            type: 'email',
            to: recipient,
            subject: job.data.subject || 'Scheduled HR report',
            body: 'Your scheduled HR report is attached.',
            companyId: job.data.companyId,
            attachments: [
              {
                filename: report.filename,
                contentBase64: report.contentBase64,
                contentType: report.mimeType,
              },
            ],
          },
          { removeOnComplete: true },
        ),
      ),
    );
    this.logger.debug(`Queued scheduled report ${job.id}`);
  }
}
