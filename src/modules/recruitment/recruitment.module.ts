import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { CalendarSyncService } from './calendar-sync.service';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { JobPostingsController } from './job-postings.controller';
import { JobPostingsService } from './job-postings.service';
import { LinkedInService } from './linkedin.service';
import { OfferTemplateService } from './offer-template.service';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { SignatureService } from './signature.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.RECRUITMENT })],
  controllers: [
    RequisitionsController,
    JobPostingsController,
    CandidatesController,
    InterviewsController,
    OffersController,
  ],
  providers: [
    RequisitionsService,
    JobPostingsService,
    CandidatesService,
    InterviewsService,
    OffersService,
    OfferTemplateService,
    SignatureService,
    LinkedInService,
    CalendarSyncService,
  ],
  exports: [CandidatesService, OffersService],
})
export class RecruitmentModule {}
