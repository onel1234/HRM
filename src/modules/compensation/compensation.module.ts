import { Module } from '@nestjs/common';
import { CompensationPdfService } from './compensation-pdf.service';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';

@Module({
  controllers: [CompensationController],
  providers: [CompensationService, CompensationPdfService],
  exports: [CompensationService],
})
export class CompensationModule {}
