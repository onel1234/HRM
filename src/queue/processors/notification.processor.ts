import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import nodemailer, { type Transporter } from 'nodemailer';
import { QUEUES } from '../queue.constants';

export interface NotificationJob {
  type: 'email' | 'whatsapp' | 'push';
  to: string;
  subject?: string;
  body: string;
  companyId: string;
  attachments?: Array<{
    filename: string;
    contentBase64: string;
    contentType: string;
  }>;
}

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private transporter?: Transporter;

  constructor(private config: ConfigService) {}

  @Process('send')
  async handleSend(job: Job<NotificationJob>) {
    if (job.data.type === 'email') {
      await this.sendEmail(job.data);
      return;
    }
    this.logger.debug(`Sending ${job.data.type} to ${job.data.to}`);
  }

  private async sendEmail(job: NotificationJob) {
    const host = this.config.get<string>('mail.host');
    if (!host) {
      this.logger.warn(
        `SMTP is not configured; skipped email to ${job.to} for company ${job.companyId}`,
      );
      return;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port') || 587,
        secure: this.config.get<boolean>('mail.secure') || false,
        auth: this.config.get<string>('mail.user')
          ? {
              user: this.config.get<string>('mail.user'),
              pass: this.config.get<string>('mail.pass'),
            }
          : undefined,
      });
    }

    await this.transporter.sendMail({
      from: this.config.get<string>('mail.from') || 'payroll@localhost',
      to: job.to,
      subject: job.subject || 'Notification',
      text: job.body,
      attachments: job.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.contentBase64, 'base64'),
        contentType: attachment.contentType,
      })),
    });
    this.logger.debug(`Sent email to ${job.to}`);
  }
}
