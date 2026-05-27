import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { EmployeeDocumentsService } from './employee-documents.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { ProbationService } from './probation.service';
import { S3PresignerService } from './s3-presigner.service';
import { SeparationService } from './separation.service';
import { SeparationsController } from './separations.controller';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS })],
  controllers: [
    DepartmentsController,
    EmployeesController,
    SeparationsController,
  ],
  providers: [
    DepartmentsService,
    EmployeesService,
    EmployeeDocumentsService,
    ProbationService,
    SeparationService,
    S3PresignerService,
  ],
  exports: [DepartmentsService, EmployeesService],
})
export class EmployeeManagementModule {}
