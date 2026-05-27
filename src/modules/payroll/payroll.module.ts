import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { PayrollController } from './payroll.controller';
import { PayrollPdfService } from './payroll-pdf.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollCalculatorService, PayrollPdfService],
  exports: [PayrollService, PayrollCalculatorService],
})
export class PayrollModule {}
