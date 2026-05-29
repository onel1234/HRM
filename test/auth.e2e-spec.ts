import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

jest.mock('@prisma/client', () => ({
  Prisma: {},
  PrismaClient: class {},
}));

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn(),
    signup: jest.fn(),
  };

  beforeEach(async () => {
    const authResponse = {
      user: {
        id: 'user-1',
        email: 'admin@acme.lk',
        firstName: 'Admin',
        lastName: 'User',
        role: 'COMPANY_ADMIN',
        companyId: 'company-1',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };
    authService.login.mockResolvedValue(authResponse);
    authService.signup.mockResolvedValue({
      ...authResponse,
      company: { id: 'company-1', name: 'Acme Lanka' },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('POST /api/v1/auth/login accepts credentials with a company header', async () => {
    // supertest accepts Nest's HTTP server shape, but the generic type is wider.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-company-id', 'company-1')
      .send({ email: 'admin@acme.lk', password: 'StrongPass123!' })
      .expect(200)
      .expect(
        ({ body }: { body: { accessToken: string; refreshToken: string } }) => {
          expect(body.accessToken).toBe('access-token');
          expect(body.refreshToken).toBe('refresh-token');
        },
      );

    expect(authService.login).toHaveBeenCalledWith(
      { email: 'admin@acme.lk', password: 'StrongPass123!' },
      'company-1',
      expect.any(String),
    );
  });

  it('POST /api/v1/auth/signup creates a company admin account', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        companyName: 'Acme Lanka',
        companyEmail: 'hello@acme.lk',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@acme.lk',
        password: 'StrongPass123!',
      })
      .expect(201)
      .expect(
        ({
          body,
        }: {
          body: { accessToken: string; company: { id: string; name: string } };
        }) => {
          expect(body.accessToken).toBe('access-token');
          expect(body.company).toEqual({ id: 'company-1', name: 'Acme Lanka' });
        },
      );

    expect(authService.signup).toHaveBeenCalledWith(
      {
        companyName: 'Acme Lanka',
        companyEmail: 'hello@acme.lk',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@acme.lk',
        password: 'StrongPass123!',
      },
      expect.any(String),
    );
  });
});
