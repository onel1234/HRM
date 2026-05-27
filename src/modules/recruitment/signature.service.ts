import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SignatureProvider, SignatureStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../core/events/event-bus.service';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventBusService,
    private config: ConfigService,
  ) {}

  /**
   * Create a signature request for an offer letter.
   * Dispatches to DocuSign or generates a local signing token.
   */
  async createSignatureRequest(
    offerLetterId: string,
    companyId: string,
    signerEmail: string,
    signerName: string,
    documentKey?: string,
  ) {
    const docusignConfigured = this.isDocuSignConfigured();
    const provider = docusignConfigured
      ? SignatureProvider.DOCUSIGN
      : SignatureProvider.LOCAL;

    const signToken = uuidv4();

    const request = await this.prisma.signatureRequest.create({
      data: {
        companyId,
        offerLetterId,
        provider,
        status: SignatureStatus.PENDING,
        signerEmail,
        signerName,
        signToken,
        documentKey,
      },
    });

    if (docusignConfigured) {
      await this.sendViaDocuSign(request.id);
    }

    return request;
  }

  /**
   * DocuSign envelope creation (scaffold).
   * Requires DOCUSIGN_ACCOUNT_ID, DOCUSIGN_INTEGRATION_KEY, etc.
   */
  private async sendViaDocuSign(requestId: string) {
    const accountId = this.config.get<string>('recruitment.docusign.accountId');
    const integrationKey = this.config.get<string>(
      'recruitment.docusign.integrationKey',
    );
    const baseUrl = this.config.get<string>('recruitment.docusign.baseUrl');

    if (!accountId || !integrationKey) {
      this.logger.warn(
        'DocuSign not fully configured — falling back to local signing',
      );
      await this.prisma.signatureRequest.update({
        where: { id: requestId },
        data: { provider: SignatureProvider.LOCAL },
      });
      return;
    }

    // TODO: Implement DocuSign eSign REST API
    // 1. Create envelope with document
    // 2. Add signer with embedded signing
    // 3. Send envelope
    // 4. Store envelope ID in externalId
    this.logger.log(`[SCAFFOLD] Would send via DocuSign: ${requestId}`);

    await this.prisma.signatureRequest.update({
      where: { id: requestId },
      data: { status: SignatureStatus.SENT, sentAt: new Date() },
    });
  }

  /** Handle local signature submission */
  async handleLocalSign(signToken: string) {
    const request = await this.prisma.signatureRequest.findFirst({
      where: { signToken },
      include: { offerLetter: { include: { application: true } } },
    });
    if (!request) throw new NotFoundException('Signature request not found');

    const updated = await this.prisma.signatureRequest.update({
      where: { id: request.id },
      data: {
        status: SignatureStatus.SIGNED,
        signedAt: new Date(),
      },
    });

    this.events.emit('signature.signed', {
      companyId: request.companyId,
      signatureRequestId: request.id,
      offerLetterId: request.offerLetterId,
    });

    return updated;
  }

  /** Handle DocuSign Connect webhook */
  async handleDocuSignWebhook(payload: any) {
    const envelopeId = payload?.envelopeId;
    if (!envelopeId) return;

    const request = await this.prisma.signatureRequest.findFirst({
      where: { externalId: envelopeId },
    });
    if (!request) {
      this.logger.warn(`No signature request for envelope: ${envelopeId}`);
      return;
    }

    const statusMap: Record<string, SignatureStatus> = {
      sent: SignatureStatus.SENT,
      delivered: SignatureStatus.VIEWED,
      completed: SignatureStatus.SIGNED,
      declined: SignatureStatus.DECLINED,
      voided: SignatureStatus.VOIDED,
    };

    const newStatus = statusMap[payload.status];
    if (!newStatus) return;

    const data: any = { status: newStatus };
    if (newStatus === SignatureStatus.VIEWED) data.viewedAt = new Date();
    if (newStatus === SignatureStatus.SIGNED) data.signedAt = new Date();
    if (newStatus === SignatureStatus.DECLINED) data.declinedAt = new Date();
    if (newStatus === SignatureStatus.VOIDED) data.voidedAt = new Date();

    await this.prisma.signatureRequest.update({
      where: { id: request.id },
      data,
    });

    if (newStatus === SignatureStatus.SIGNED) {
      this.events.emit('signature.signed', {
        companyId: request.companyId,
        signatureRequestId: request.id,
        offerLetterId: request.offerLetterId,
      });
    }
  }

  async getStatus(offerLetterId: string, companyId: string) {
    const request = await this.prisma.signatureRequest.findFirst({
      where: { offerLetterId, companyId },
    });
    if (!request) throw new NotFoundException('Signature request not found');
    return request;
  }

  private isDocuSignConfigured(): boolean {
    return !!(
      this.config.get<string>('recruitment.docusign.accountId') &&
      this.config.get<string>('recruitment.docusign.integrationKey')
    );
  }
}
