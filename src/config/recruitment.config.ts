import { registerAs } from '@nestjs/config';

export default registerAs('recruitment', () => ({
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    orgId: process.env.LINKEDIN_ORG_ID,
    apiBaseUrl:
      process.env.LINKEDIN_API_BASE_URL ||
      'https://api.linkedin.com/v2',
  },
  docusign: {
    accountId: process.env.DOCUSIGN_ACCOUNT_ID,
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
    baseUrl:
      process.env.DOCUSIGN_BASE_URL ||
      'https://demo.docusign.net/restapi',
    privateKeyPath: process.env.DOCUSIGN_PRIVATE_KEY_PATH,
    userId: process.env.DOCUSIGN_USER_ID,
  },
  careerPageBaseUrl:
    process.env.CAREER_PAGE_BASE_URL || 'http://localhost:3001/careers',
  offerTokenExpiryDays: parseInt(
    process.env.OFFER_TOKEN_EXPIRY_DAYS || '7',
    10,
  ),
  signatureTokenExpiryDays: parseInt(
    process.env.SIGNATURE_TOKEN_EXPIRY_DAYS || '14',
    10,
  ),
}));
