# HR System — Phase 1: Backend Scaffold & Auth
**Stack:** NestJS · TypeScript · PostgreSQL · Prisma · Redis · BullMQ · JWT  
**Target:** Sri Lankan multi-company HR platform, AI-ready architecture  
**Duration:** 3 weeks  

---

## Table of contents

1. [Project structure](#1-project-structure)
2. [Tech stack & versions](#2-tech-stack--versions)
3. [Environment configuration](#3-environment-configuration)
4. [Database schema](#4-database-schema)
5. [Prisma setup](#5-prisma-setup)
6. [Core module](#6-core-module)
7. [Auth module](#7-auth-module)
8. [Users module](#8-users-module)
9. [Companies module](#9-companies-module)
10. [Event bus](#10-event-bus)
11. [Redis & BullMQ](#11-redis--bullmq)
12. [Guards & decorators](#12-guards--decorators)
13. [API versioning & Swagger](#13-api-versioning--swagger)
14. [Error handling](#14-error-handling)
15. [Logging](#15-logging)
16. [CI/CD pipeline](#16-cicd-pipeline)
17. [Docker setup](#17-docker-setup)
18. [Testing strategy](#18-testing-strategy)
19. [AI readiness checklist](#19-ai-readiness-checklist)
20. [Week-by-week task breakdown](#20-week-by-week-task-breakdown)

---

## 1. Project structure

```
hr-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── core/
│   │   ├── core.module.ts
│   │   ├── events/
│   │   │   ├── event-bus.service.ts
│   │   │   └── events.types.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── utils/
│   │       ├── pagination.util.ts
│   │       └── crypto.util.ts
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   └── redis.config.ts
│   ├── database/
│   │   └── prisma.service.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── jwt-refresh.strategy.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       ├── refresh-token.dto.ts
│   │   │       └── change-password.dto.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       └── update-user.dto.ts
│   │   └── companies/
│   │       ├── companies.module.ts
│   │       ├── companies.controller.ts
│   │       ├── companies.service.ts
│   │       └── dto/
│   │           └── create-company.dto.ts
│   └── queue/
│       ├── queue.module.ts
│       └── processors/
│           └── notification.processor.ts
├── test/
│   ├── auth.e2e-spec.ts
│   └── jest-e2e.json
├── .env.example
├── .env.development
├── docker-compose.yml
├── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
└── package.json
```

---

## 2. Tech stack & versions

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/bull": "^10.0.0",
    "@nestjs/event-emitter": "^2.0.0",
    "@prisma/client": "^5.0.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.0",
    "bcryptjs": "^2.4.3",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "bull": "^4.12.0",
    "ioredis": "^5.3.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "winston": "^3.11.0",
    "nest-winston": "^1.9.4",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "prisma": "^5.0.0",
    "typescript": "^5.1.0",
    "jest": "^29.0.0",
    "supertest": "^6.3.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/passport-jwt": "^3.0.13"
  }
}
```

**Scaffold the project:**
```bash
npm i -g @nestjs/cli
nest new hr-backend --package-manager npm
cd hr-backend
npm install @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/swagger @nestjs/bull @nestjs/event-emitter
npm install @prisma/client passport passport-jwt bcryptjs class-validator class-transformer bull ioredis helmet compression winston nest-winston uuid
npm install -D prisma @types/passport-jwt @types/bcryptjs supertest
npx prisma init
```

---

## 3. Environment configuration

### `.env.example`
```env
# App
NODE_ENV=development
PORT=3000
API_PREFIX=api
API_VERSION=v1

# Database
DATABASE_URL=postgresql://hr_user:hr_pass@localhost:5432/hr_db?schema=public

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# App
BCRYPT_ROUNDS=12
COMPANY_ID_HEADER=x-company-id

# CORS
CORS_ORIGINS=http://localhost:3001,http://localhost:3002

# File storage (S3-compatible)
S3_ENDPOINT=
S3_BUCKET=hr-documents
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=ap-southeast-1
```

### `src/config/app.config.ts`
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || 'v1',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
  companyIdHeader: process.env.COMPANY_ID_HEADER || 'x-company-id',
}));
```

### `src/config/jwt.config.ts`
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));
```

### `src/config/redis.config.ts`
```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
}));
```

---

## 4. Database schema

### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

enum UserRole {
  SUPER_ADMIN    // Manages all companies (SaaS owner)
  COMPANY_ADMIN  // Full HR admin for one company
  HR_MANAGER     // HR staff – most HR actions
  MANAGER        // Line manager – approve leave, view team
  EMPLOYEE       // Self-service only
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}

enum CompanyStatus {
  ACTIVE
  SUSPENDED
  TRIAL
}

// ─────────────────────────────────────────
// COMPANY (multi-tenant root)
// ─────────────────────────────────────────

model Company {
  id            String        @id @default(uuid())
  name          String
  registrationNo String?      @unique
  taxNo         String?       // IRD tax number
  address       String?
  phone         String?
  email         String?
  logoUrl       String?
  status        CompanyStatus @default(TRIAL)
  timezone      String        @default("Asia/Colombo")
  currency      String        @default("LKR")
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relations
  users         User[]
  auditLogs     AuditLog[]

  @@map("companies")
}

// ─────────────────────────────────────────
// USER (system auth identity)
// ─────────────────────────────────────────

model User {
  id            String     @id @default(uuid())
  companyId     String
  email         String
  passwordHash  String
  role          UserRole   @default(EMPLOYEE)
  status        UserStatus @default(PENDING_VERIFICATION)
  firstName     String
  lastName      String
  phone         String?
  avatarUrl     String?
  lastLoginAt   DateTime?

  // AI readiness: consent flags stored from day 1
  dataProcessingConsent Boolean @default(false)
  consentGivenAt        DateTime?

  // Refresh token (hashed, stored for rotation)
  refreshTokenHash String?

  // Email verification
  emailVerificationToken String?
  emailVerifiedAt        DateTime?

  // Password reset
  passwordResetToken     String?
  passwordResetExpiresAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  company   Company    @relation(fields: [companyId], references: [id])
  auditLogs AuditLog[]

  // A user email is unique per company, not globally
  @@unique([companyId, email])
  @@index([companyId])
  @@index([email])
  @@map("users")
}

// ─────────────────────────────────────────
// AUDIT LOG (every action, forever)
// AI readiness: full history for ML training
// ─────────────────────────────────────────

model AuditLog {
  id         String   @id @default(uuid())
  companyId  String
  userId     String?  // null for system actions
  action     String   // e.g. "user.login", "payroll.run", "leave.approve"
  entityType String?  // e.g. "User", "Leave", "Payroll"
  entityId   String?
  oldValues  Json?    // snapshot before change
  newValues  Json?    // snapshot after change
  ipAddress  String?
  userAgent  String?
  metadata   Json?    // arbitrary extra context
  createdAt  DateTime @default(now())

  company Company  @relation(fields: [companyId], references: [id])
  user    User?    @relation(fields: [userId], references: [id])

  @@index([companyId])
  @@index([userId])
  @@index([entityType, entityId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
```

> Note: Employee, Payroll, Leave, Attendance tables are added in Phase 1 modules that follow. This schema covers the auth scaffold only.

---

## 5. Prisma setup

### `src/database/prisma.service.ts`
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Helper: soft-delete pattern
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

---

## 6. Core module

### `src/core/core.module.ts`
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from './events/event-bus.service';
import { AuditService } from './audit/audit.service';

@Global()
@Module({
  providers: [PrismaService, EventBusService, AuditService],
  exports: [PrismaService, EventBusService, AuditService],
})
export class CoreModule {}
```

### `src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    // Config — load env, validate, make global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig, redisConfig],
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
    }),

    // Internal domain event bus
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),

    // BullMQ job queues backed by Redis
    BullModule.forRootAsync({
      useFactory: (config) => ({
        redis: {
          host: config.get('redis.host'),
          port: config.get('redis.port'),
          password: config.get('redis.password'),
        },
      }),
      inject: ['ConfigService'],
    }),

    CoreModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
  ],
})
export class AppModule {}
```

### `src/main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
  });

  // Global prefix + URI versioning  (/api/v1/...)
  app.setGlobalPrefix(config.get('app.apiPrefix'));
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: config.get('app.apiVersion'),
  });

  // Global validation pipe — strip unknown fields, auto-transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger (development + staging only)
  if (config.get('app.nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HR System API')
      .setDescription('Sri Lankan HR Platform — Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-company-id' }, 'company-id')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('app.port');
  await app.listen(port);
  console.log(`HR Backend running on port ${port}`);
}

bootstrap();
```

---

## 7. Auth module

### `src/modules/auth/dto/login.dto.ts`
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@acme.lk' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
```

### `src/modules/auth/dto/change-password.dto.ts`
```typescript
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and a number',
  })
  newPassword: string;
}
```

### `src/modules/auth/strategies/jwt.strategy.ts`
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  companyId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        companyId: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    return user; // attached as req.user
  }
}
```

### `src/modules/auth/strategies/jwt-refresh.strategy.ts`
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.body.refreshToken;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, companyId: true, role: true, refreshTokenHash: true, status: true },
    });

    if (!user || !user.refreshTokenHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Refresh token invalid');

    return user;
  }
}
```

### `src/modules/auth/auth.service.ts`
```typescript
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { AuditService } from '../../core/audit/audit.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto, companyId: string, ipAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.companyId);

    // Hash and store refresh token
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
    });

    // Audit log
    await this.audit.log({
      companyId,
      userId: user.id,
      action: 'auth.login',
      ipAddress,
    });

    // Domain event — AI modules can subscribe to user.loggedIn
    this.eventBus.emit('user.loggedIn', { userId: user.id, companyId });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, companyId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user.id, user.email, user.role, companyId);
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: refreshHash },
    });

    return tokens;
  }

  async logout(userId: string, companyId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.audit.log({ companyId, userId, action: 'auth.logout' });
  }

  async changePassword(userId: string, companyId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const rounds = this.config.get<number>('app.bcryptRounds');
    const hash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, refreshTokenHash: null },
    });

    await this.audit.log({ companyId, userId, action: 'auth.passwordChanged' });
  }

  private async generateTokens(userId: string, email: string, role: string, companyId: string) {
    const payload = { sub: userId, email, role, companyId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
```

### `src/modules/auth/auth.controller.ts`
```typescript
import { Controller, Post, Body, UseGuards, Get, Req, HttpCode, HttpStatus, Version } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    const companyId = req.headers['x-company-id'] as string;
    const ip = req.ip;
    return this.authService.login(dto, companyId, ip);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@CurrentUser() user: any) {
    return this.authService.refreshTokens(user.id, user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id, user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth()
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.id,
      user.companyId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: any) {
    return user;
  }
}
```

### `src/modules/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 8. Users module

### `src/modules/users/dto/create-user.dto.ts`
```typescript
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}
```

### `src/modules/users/users.service.ts`
```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { EventBusService } from '../../core/events/event-bus.service';
import { AuditService } from '../../core/audit/audit.service';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, companyId: string, createdByUserId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Email already exists in this company');

    const rounds = this.config.get<number>('app.bcryptRounds');
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        companyId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        phone: dto.phone,
        status: 'ACTIVE',
      },
      select: {
        id: true, email: true, firstName: true,
        lastName: true, role: true, status: true, createdAt: true,
      },
    });

    await this.audit.log({
      companyId,
      userId: createdByUserId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });

    // AI hook: fires domain event for any future subscriber
    this.eventBus.emit('user.created', { userId: user.id, companyId, role: user.role });

    return user;
  }

  async findAll(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId },
        skip,
        take: limit,
        select: {
          id: true, email: true, firstName: true,
          lastName: true, role: true, status: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { companyId } }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, phone: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
```

---

## 9. Companies module

### `src/modules/companies/companies.service.ts`
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { EventBusService } from '../../core/events/event-bus.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({ data: dto });
    this.eventBus.emit('company.created', { companyId: company.id });
    return company;
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, data: Partial<CreateCompanyDto>) {
    return this.prisma.company.update({ where: { id }, data });
  }
}
```

### `src/modules/companies/dto/create-company.dto.ts`
```typescript
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  registrationNo?: string;

  @IsString()
  @IsOptional()
  taxNo?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
```

---

## 10. Event bus

This is the most important AI-readiness piece. Every module emits typed events. AI modules later subscribe with zero changes to core code.

### `src/core/events/events.types.ts`
```typescript
// Typed event definitions — add new events here as modules are built
// AI modules subscribe to these without touching the emitting service

export interface UserCreatedEvent {
  userId: string;
  companyId: string;
  role: string;
}

export interface UserLoggedInEvent {
  userId: string;
  companyId: string;
}

export interface CompanyCreatedEvent {
  companyId: string;
}

// Future events (defined now so the schema is consistent)
export interface PayrollProcessedEvent {
  companyId: string;
  payrollRunId: string;
  period: string;
  totalEmployees: number;
}

export interface LeaveApprovedEvent {
  companyId: string;
  employeeId: string;
  leaveId: string;
  type: string;
  startDate: Date;
  endDate: Date;
}

export interface EmployeeJoinedEvent {
  companyId: string;
  employeeId: string;
  departmentId: string;
  role: string;
  joinDate: Date;
}

export interface EmployeeSeparatedEvent {
  companyId: string;
  employeeId: string;
  reason: string;
  separationDate: Date;
}
```

### `src/core/events/event-bus.service.ts`
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private emitter: EventEmitter2) {}

  emit<T>(event: string, payload: T): void {
    this.logger.debug(`Event emitted: ${event}`);
    this.emitter.emit(event, payload);
  }

  // Async emit — for events where subscribers should not block the caller
  async emitAsync<T>(event: string, payload: T): Promise<void> {
    this.logger.debug(`Async event emitted: ${event}`);
    await this.emitter.emitAsync(event, payload);
  }
}

// ─── How to subscribe in any service ────────────────────────────────────────
//
// import { OnEvent } from '@nestjs/event-emitter';
//
// @OnEvent('payroll.processed')
// async handlePayrollProcessed(payload: PayrollProcessedEvent) {
//   // AI module logic here — zero changes to PayrollService
// }
// ────────────────────────────────────────────────────────────────────────────
```

### `src/core/audit/audit.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface AuditLogInput {
  companyId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    // Fire-and-forget — never block the main request
    this.prisma.auditLog.create({ data: input }).catch(() => {
      // Silently fail — audit failure must not break business logic
    });
  }
}
```

---

## 11. Redis & BullMQ

### `src/queue/queue.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationProcessor } from './processors/notification.processor';

// Register queues here — add more as modules are built
export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  PAYROLL: 'payroll',        // registered in PayrollModule later
  REPORTS: 'reports',        // registered in ReportsModule later
};

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.NOTIFICATIONS },
    ),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
```

### `src/queue/processors/notification.processor.ts`
```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { QUEUES } from '../queue.module';

export interface NotificationJob {
  type: 'email' | 'whatsapp' | 'push';
  to: string;
  subject?: string;
  body: string;
  companyId: string;
}

@Processor(QUEUES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process('send')
  async handleSend(job: Job<NotificationJob>) {
    this.logger.debug(`Sending ${job.data.type} to ${job.data.to}`);
    // Integrate email / WhatsApp sender here in Phase 2
  }
}
```

---

## 12. Guards & decorators

### `src/core/guards/jwt-auth.guard.ts`
```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### `src/core/guards/roles.guard.ts`
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.EMPLOYEE,
  UserRole.MANAGER,
  UserRole.HR_MANAGER,
  UserRole.COMPANY_ADMIN,
  UserRole.SUPER_ADMIN,
];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    const userLevel = ROLE_HIERARCHY.indexOf(user.role);
    const requiredLevel = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY.indexOf(r)));

    if (userLevel < requiredLevel) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
```

### `src/core/decorators/public.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### `src/core/decorators/roles.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### `src/core/decorators/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### `src/core/interceptors/transform.interceptor.ts`
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Wraps all responses in a consistent envelope: { success, data, timestamp }
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### `src/core/filters/all-exceptions.filter.ts`
```typescript
import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 13. API versioning & Swagger

All routes are automatically versioned as `/api/v1/...` via `VersioningType.URI` in `main.ts`. Each controller declares `version: '1'`.

When a breaking change is needed, add `version: '2'` to the new controller — old clients keep hitting v1 unaffected.

Swagger is available at `http://localhost:3000/docs` in development. Every DTO should have `@ApiProperty()` decorators — these generate the schema automatically.

---

## 14. Error handling

Standard error codes to use consistently:

| Situation | Exception | HTTP status |
|---|---|---|
| Not found | `NotFoundException` | 404 |
| Duplicate record | `ConflictException` | 409 |
| Bad input | `BadRequestException` | 400 |
| Unauthenticated | `UnauthorizedException` | 401 |
| No permission | `ForbiddenException` | 403 |
| Server fault | (caught by filter) | 500 |

Never throw raw `Error` — always use NestJS HTTP exceptions so the filter produces consistent JSON.

---

## 15. Logging

Use `nest-winston` with structured JSON in production, pretty-print in development:

```typescript
// In AppModule imports:
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

WinstonModule.forRoot({
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
})
```

Log levels: `error` for exceptions, `warn` for slow queries > 200ms, `debug` for event emissions, `verbose` for request/response in development.

---

## 16. CI/CD pipeline

### `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: hr_user
          POSTGRES_PASSWORD: hr_pass
          POSTGRES_DB: hr_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://hr_user:hr_pass@localhost:5432/hr_test

      - run: npm run test
      - run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://hr_user:hr_pass@localhost:5432/hr_test
          JWT_SECRET: test-secret-32-chars-minimum-here
          JWT_REFRESH_SECRET: test-refresh-secret-32-chars-min
          REDIS_HOST: localhost

      - run: npm run build
```

---

## 17. Docker setup

### `docker-compose.yml` (local development)
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: hr_user
      POSTGRES_PASSWORD: hr_pass
      POSTGRES_DB: hr_db
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data

  api:
    build:
      context: .
      target: development
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://hr_user:hr_pass@postgres:5432/hr_db
      REDIS_HOST: redis
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
    command: npm run start:dev

volumes:
  pgdata:
  redisdata:
```

### `Dockerfile`
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS development
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## 18. Testing strategy

### Unit test example — `auth.service.spec.ts`
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
        { provide: EventBusService, useValue: { emit: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        // mock JwtService, ConfigService
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
  });

  it('should throw on invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: 'wrong' }, 'company-1', '127.0.0.1'))
      .rejects.toThrow(UnauthorizedException);
  });
});
```

Run tests:
```bash
npm run test              # unit tests
npm run test:e2e          # end-to-end
npm run test:cov          # coverage report
```

Target: 80%+ coverage on `auth`, `users`, `companies` services before moving to Phase 2.

---

## 19. AI readiness checklist

These must be true before Phase 2 begins. Check each one:

- [ ] Every service method emits a domain event via `EventBusService`
- [ ] Every mutating action writes to `AuditLog` with `oldValues` / `newValues`
- [ ] All Prisma models have `createdAt` and `updatedAt` timestamps
- [ ] User model has `dataProcessingConsent` and `consentGivenAt` fields
- [ ] API is versioned (`/v1/`) and adding `/v2/` requires zero changes to v1 code
- [ ] `EventEmitterModule` is configured with `wildcard: true` so AI subscribers can use `payroll.*`
- [ ] Raw data is never discarded — feedback text, documents stored in object store, not just summaries
- [ ] Redis job queues are named constants in `QUEUES` object — AI workers use the same queue infrastructure
- [ ] `AuditLog` has indexes on `entityType`, `entityId`, `action`, and `createdAt` — queries the AI analytics layer will run

---

## 20. Week-by-week task breakdown

### Week 1 — Infrastructure & skeleton

| Day | Task |
|-----|------|
| 1 | `nest new` project, install all dependencies, commit baseline |
| 1 | Docker Compose up — Postgres + Redis running locally |
| 2 | `prisma init`, write Company + User + AuditLog schema, first migration |
| 2 | `PrismaService`, `CoreModule`, `EventBusService`, `AuditService` |
| 3 | `main.ts` — helmet, CORS, versioning, ValidationPipe, Swagger |
| 3 | `AllExceptionsFilter`, `TransformInterceptor`, `LoggingInterceptor` |
| 4 | `ConfigModule` with all config files, `.env.example` documented |
| 4 | `QueueModule` with BullMQ, `NotificationProcessor` stub |
| 5 | GitHub Actions CI workflow — lint, test, build on every PR |

### Week 2 — Auth

| Day | Task |
|-----|------|
| 1 | `JwtStrategy`, `JwtRefreshStrategy`, `PassportModule` wired |
| 1 | `AuthService.login()` with bcrypt verify + token generation |
| 2 | `AuthService.refreshTokens()` + `logout()` + `changePassword()` |
| 2 | `AuthController` — POST /auth/login, /auth/refresh, /auth/logout |
| 3 | `JwtAuthGuard` with `@Public()` bypass, `RolesGuard` with hierarchy |
| 3 | `@CurrentUser()`, `@Roles()`, `@Public()` decorators |
| 4 | Unit tests for `AuthService` — all happy paths + all error paths |
| 5 | E2E test: full login → refresh → logout flow |

### Week 3 — Users, Companies & polish

| Day | Task |
|-----|------|
| 1 | `UsersService` — create, findAll (paginated), findOne, deactivate |
| 1 | `UsersController` — guarded with `@Roles(HR_MANAGER, COMPANY_ADMIN)` |
| 2 | `CompaniesService` + `CompaniesController` (SUPER_ADMIN only) |
| 2 | Multi-tenant middleware: read `x-company-id` header, validate company exists |
| 3 | Seed script: create 1 company + 1 COMPANY_ADMIN user for local dev |
| 3 | Swagger annotations complete on all controllers and DTOs |
| 4 | Unit tests for `UsersService`, `CompaniesService` |
| 4 | AI readiness checklist — verify all 9 items above |
| 5 | Code review, fix tech debt, tag `v0.1.0-scaffold`, hand off to Phase 2 |
