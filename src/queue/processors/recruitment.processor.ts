import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUES } from '../queue.constants';

@Processor(QUEUES.RECRUITMENT)
export class RecruitmentProcessor {
  private readonly logger = new Logger(RecruitmentProcessor.name);

  @Process('linkedin-publish')
  async handleLinkedInPublish(job: Job<unknown>) {
    this.logger.log(`Publishing job to LinkedIn: ${JSON.stringify(job.data)}`);
  }

  @Process('offer-email')
  async handleOfferEmail(job: Job<unknown>) {
    this.logger.log(`Sending offer email: ${JSON.stringify(job.data)}`);
  }

  @Process('interview-reminder')
  async handleInterviewReminder(job: Job<unknown>) {
    this.logger.log(`Sending interview reminder: ${JSON.stringify(job.data)}`);
  }

  @Process('signature-reminder')
  async handleSignatureReminder(job: Job<unknown>) {
    this.logger.log(`Sending signature reminder: ${JSON.stringify(job.data)}`);
  }

  @Process('onboarding-reminder')
  async handleOnboardingReminder(job: Job<unknown>) {
    this.logger.log(`Sending onboarding reminder: ${JSON.stringify(job.data)}`);
  }
}
