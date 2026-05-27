import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  EmployeeStatus,
  ProbationStatus,
  UserRole,
} from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CompleteEmployeeDocumentDto } from './dto/complete-employee-document.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateProbationReviewDto } from './dto/create-probation-review.dto';
import { CreateSeparationDto } from './dto/create-separation.dto';
import { PresignEmployeeDocumentDto } from './dto/presign-employee-document.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeDocumentsService } from './employee-documents.service';
import { EmployeesService } from './employees.service';
import { ProbationService } from './probation.service';
import { SeparationService } from './separation.service';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'employees', version: '1' })
export class EmployeesController {
  constructor(
    private employees: EmployeesService,
    private documents: EmployeeDocumentsService,
    private probation: ProbationService,
    private separations: SeparationService,
  ) {}

  @Post()
  @Roles(UserRole.HR_MANAGER)
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.create(dto, user.companyId, user.id);
  }

  @Get()
  @Roles(UserRole.MANAGER)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('employmentType') employmentType?: string,
    @Query('managerId') managerId?: string,
    @Query('probationStatus') probationStatus?: ProbationStatus,
    @Query('search') search?: string,
  ) {
    return this.employees.findAll(user.companyId, {
      page,
      limit,
      departmentId,
      status,
      employmentType,
      managerId,
      probationStatus,
      search,
    });
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Roles(UserRole.HR_MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.employees.update(id, dto, user.companyId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.HR_MANAGER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.employees.remove(id, user.companyId, user.id);
  }

  @Post(':id/documents/presign-upload')
  @Roles(UserRole.HR_MANAGER)
  presignUpload(
    @Param('id') id: string,
    @Body() dto: PresignEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.createUploadUrl(id, dto, user.companyId, user.id);
  }

  @Post(':id/documents/:documentId/complete')
  @Roles(UserRole.HR_MANAGER)
  completeUpload(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: CompleteEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.completeUpload(
      id,
      documentId,
      dto,
      user.companyId,
      user.id,
    );
  }

  @Get(':id/documents/:documentId/presign-download')
  @Roles(UserRole.MANAGER)
  presignDownload(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documents.createDownloadUrl(id, documentId, user.companyId);
  }

  @Post(':id/probation/reviews')
  @Roles(UserRole.HR_MANAGER)
  createProbationReview(
    @Param('id') id: string,
    @Body() dto: CreateProbationReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.probation.createReview(id, dto, user.companyId, user.id);
  }

  @Post(':id/separation')
  @Roles(UserRole.HR_MANAGER)
  createSeparation(
    @Param('id') id: string,
    @Body() dto: CreateSeparationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.separations.create(id, dto, user.companyId, user.id);
  }
}
