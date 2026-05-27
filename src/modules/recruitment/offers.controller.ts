import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OfferStatus, UserRole } from '@prisma/client';
import * as express from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/types/authenticated-user';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateOfferTemplateDto } from './dto/create-offer-template.dto';
import { OffersService } from './offers.service';
import { OfferTemplateService } from './offer-template.service';
import { SignatureService } from './signature.service';

@ApiTags('Offers')
@Controller({ version: '1' })
export class OffersController {
  constructor(
    private offers: OffersService,
    private offerTemplates: OfferTemplateService,
    private signaturesSvc: SignatureService,
  ) {}

  // ─── Offer CRUD ────────────────────────────────────────────

  @Post('offers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  create(@Body() dto: CreateOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.create(dto, user.companyId, user.id);
  }

  @Get('offers')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('page') page?: number, @Query('limit') limit?: number, @Query('status') status?: OfferStatus) {
    return this.offers.findAll(user.companyId, { page, limit, status });
  }

  @Get('offers/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.findOne(id, user.companyId);
  }

  @Post('offers/:id/generate-pdf')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  async generatePdf(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Res() res: express.Response) {
    const { pdfBuffer } = await this.offers.generatePdf(id, user.companyId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="offer-${id}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post('offers/:id/approve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.approve(id, user.companyId, user.id);
  }

  @Post('offers/:id/send')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.send(id, user.companyId, user.id);
  }

  @Post('offers/:id/revoke')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.revoke(id, user.companyId, user.id);
  }

  // ─── Public offer endpoints ────────────────────────────────

  @Get('public/offers/:token')
  @Public()
  findByToken(@Param('token') token: string) {
    return this.offers.findByToken(token);
  }

  @Post('public/offers/:token/respond')
  @Public()
  respond(@Param('token') token: string, @Body('response') response: 'accept' | 'decline') {
    return this.offers.respond(token, response);
  }

  // ─── DocuSign webhook ──────────────────────────────────────

  @Post('webhooks/docusign')
  @Public()
  handleDocuSignWebhook(@Body() payload: any) {
    return this.signaturesSvc.handleDocuSignWebhook(payload);
  }

  // ─── Offer Templates ──────────────────────────────────────

  @Post('offer-templates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  createTemplate(@Body() dto: CreateOfferTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offerTemplates.create(dto, user.companyId);
  }

  @Get('offer-templates')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR_MANAGER)
  findAllTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.offerTemplates.findAll(user.companyId);
  }
}
