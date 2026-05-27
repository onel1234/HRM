import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

type PresignMethod = 'GET' | 'PUT';

@Injectable()
export class S3PresignerService {
  constructor(private config: ConfigService) {}

  presign(method: PresignMethod, objectKey: string, expiresSeconds?: number) {
    const endpoint =
      this.config.get<string>('storage.s3.endpoint') ||
      `https://s3.${this.region}.amazonaws.com`;
    const bucket = this.bucket;
    const accessKey = this.config.get<string>('storage.s3.accessKey');
    const secretKey = this.config.get<string>('storage.s3.secretKey');
    const expires =
      expiresSeconds ||
      this.config.get<number>('storage.s3.presignExpiresSeconds') ||
      900;

    if (!accessKey || !secretKey) {
      throw new BadRequestException('S3 credentials are not configured');
    }

    const now = new Date();
    const amzDate = this.toAmzDate(now);
    const shortDate = amzDate.slice(0, 8);
    const scope = `${shortDate}/${this.region}/s3/aws4_request`;
    const url = new URL(endpoint);
    const canonicalUri = `/${bucket}/${this.encodePath(objectKey)}`;

    url.pathname = this.joinPath(url.pathname, canonicalUri);

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKey}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expires),
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalQuery = Array.from(query.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`)
      .join('&');
    const canonicalHeaders = `host:${url.host}\n`;
    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = this.getSigningKey(secretKey, shortDate);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    query.set('X-Amz-Signature', signature);
    url.search = query.toString();
    return url.toString();
  }

  get bucket() {
    return this.config.get<string>('storage.s3.bucket') || 'hr-documents';
  }

  private get region() {
    return this.config.get<string>('storage.s3.region') || 'ap-southeast-1';
  }

  private getSigningKey(secretKey: string, shortDate: string) {
    const dateKey = createHmac('sha256', `AWS4${secretKey}`)
      .update(shortDate)
      .digest();
    const regionKey = createHmac('sha256', dateKey)
      .update(this.region)
      .digest();
    const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
    return createHmac('sha256', serviceKey).update('aws4_request').digest();
  }

  private toAmzDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private encode(value: string) {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private encodePath(path: string) {
    return path
      .split('/')
      .map((part) => this.encode(part))
      .join('/');
  }

  private joinPath(basePath: string, canonicalPath: string) {
    const base = basePath === '/' ? '' : basePath.replace(/\/$/, '');
    return `${base}${canonicalPath}`;
  }
}
