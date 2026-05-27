import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../database/prisma.service';
import { CreateOfferTemplateDto } from './dto/create-offer-template.dto';

@Injectable()
export class OfferTemplateService {
  private readonly logger = new Logger(OfferTemplateService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOfferTemplateDto, companyId: string) {
    return this.prisma.offerLetterTemplate.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        content: dto.content,
        variables: dto.variables ?? undefined,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.offerLetterTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const template = await this.prisma.offerLetterTemplate.findFirst({
      where: { id, companyId },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(
    id: string,
    dto: Partial<CreateOfferTemplateDto>,
    companyId: string,
  ) {
    await this.findOne(id, companyId);
    return this.prisma.offerLetterTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        content: dto.content,
        variables: dto.variables ?? undefined,
      },
    });
  }

  /**
   * Render template content by replacing {{variable}} placeholders
   * with values from the provided context.
   */
  renderContent(templateContent: string, variables: Record<string, any>): string {
    let rendered = templateContent;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value ?? ''));
    }
    return rendered;
  }

  /**
   * Generate a PDF buffer from rendered text content using PDFKit.
   */
  async generatePdf(content: string, metadata: {
    companyName: string;
    candidateName: string;
    jobTitle: string;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 72, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(metadata.companyName, { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(16)
        .text('Offer Letter', { align: 'center' })
        .moveDown(1);

      // Date
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'right' })
        .moveDown(1);

      // Dear candidate
      doc
        .fontSize(12)
        .text(`Dear ${metadata.candidateName},`)
        .moveDown(0.5);

      // Body — render the template content line by line
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.5);
        } else {
          doc.text(line.trim());
        }
      }

      doc.moveDown(2);
      doc
        .text('_______________________________')
        .text('Authorized Signatory')
        .moveDown(1);

      doc
        .text('_______________________________')
        .text(`${metadata.candidateName} — Candidate Signature`);

      doc.end();
    });
  }
}
