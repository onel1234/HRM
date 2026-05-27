import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateDocumentRequestDto } from './dto/create-document-request.dto';
import { DocumentCollectionService } from './document-collection.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('Onboarding Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'onboarding/documents', version: '1' })
export class DocumentCollectionController {
  constructor(private docs: DocumentCollectionService, private prisma: PrismaService) {}

  @Post('requests')
  @Roles(UserRole.HR_MANAGER)
  createRequest(@Body() dto: CreateDocumentRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.docs.createRequest(dto, user.companyId, user.id);
  }

  @Get('my')
  @Roles(UserRole.EMPLOYEE)
  async getMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({ where: { userId: user.id, companyId: user.companyId } });
    if (!employee) return [];
    return this.docs.getMyDocumentRequests(employee.id, user.companyId);
  }

  @Post(':id/presign-upload')
  @Roles(UserRole.EMPLOYEE)
  presignUpload(@Param('id') id: string, @Body('fileName') fileName: string, @Body('mimeType') mimeType: string, @CurrentUser() user: AuthenticatedUser) {
    return this.docs.presignUpload(id, user.companyId, fileName, mimeType);
  }

  @Post(':id/complete-upload')
  @Roles(UserRole.EMPLOYEE)
  completeUpload(@Param('id') id: string, @Body('sizeBytes') sizeBytes: number, @CurrentUser() user: AuthenticatedUser) {
    return this.docs.completeUpload(id, user.companyId, sizeBytes);
  }

  @Post(':id/approve')
  @Roles(UserRole.HR_MANAGER)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.docs.approve(id, user.companyId, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.HR_MANAGER)
  reject(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: AuthenticatedUser) {
    return this.docs.reject(id, user.companyId, user.id, reason);
  }
}
