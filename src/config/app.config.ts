import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || 'v1',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3001',
  ],
  companyIdHeader: process.env.COMPANY_ID_HEADER || 'x-company-id',
}));
