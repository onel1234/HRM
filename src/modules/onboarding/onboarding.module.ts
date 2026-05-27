import { Module } from '@nestjs/common';
import { DocumentCollectionController } from './document-collection.controller';
import { DocumentCollectionService } from './document-collection.service';
import { OnboardingChecklistsController } from './onboarding-checklists.controller';
import { OnboardingChecklistsService } from './onboarding-checklists.service';
import { OnboardingPortalController } from './onboarding-portal.controller';
import { OnboardingPortalService } from './onboarding-portal.service';

@Module({
  controllers: [
    OnboardingChecklistsController,
    OnboardingPortalController,
    DocumentCollectionController,
  ],
  providers: [
    OnboardingChecklistsService,
    OnboardingPortalService,
    DocumentCollectionService,
  ],
  exports: [OnboardingChecklistsService],
})
export class OnboardingModule {}
