import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../../core/audit/audit.service';
import { EventBusService } from '../../core/events/event-bus.service';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private eventBus: EventBusService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto, companyId: string, ipAddress?: string) {
    if (!companyId)
      throw new BadRequestException('Company id header is required');

    const user = await this.prisma.user.findUnique({
      where: { companyId_email: { companyId, email: dto.email } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.companyId,
    );
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
    });

    await this.audit.log({
      companyId,
      userId: user.id,
      action: 'auth.login',
      ipAddress,
    });
    this.eventBus.emit('user.loggedIn', { userId: user.id, companyId });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
      },
      ...tokens,
    };
  }

  async signup(dto: SignupDto, ipAddress?: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existing) throw new ConflictException('Email already exists');

    const rounds = this.config.get<number>('app.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const { company, user } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          email: dto.companyEmail,
          phone: dto.phone,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: UserRole.COMPANY_ADMIN,
          status: 'ACTIVE',
          dataProcessingConsent: true,
          consentGivenAt: new Date(),
        },
      });

      return { company, user };
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      company.id,
    );
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: refreshHash, lastLoginAt: new Date() },
    });

    await this.audit.log({
      companyId: company.id,
      userId: user.id,
      action: 'auth.signup',
      ipAddress,
    });
    this.eventBus.emit('company.created', { companyId: company.id });
    this.eventBus.emit('user.created', {
      userId: user.id,
      companyId: company.id,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: company.id,
      },
      company: {
        id: company.id,
        name: company.name,
      },
      ...tokens,
    };
  }

  async refreshTokens(userId: string, companyId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException();

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      companyId,
    );
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

  async changePassword(
    userId: string,
    companyId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const rounds = this.config.get<number>('app.bcryptRounds') || 12;
    const hash = await bcrypt.hash(newPassword, rounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, refreshTokenHash: null },
    });
    await this.audit.log({ companyId, userId, action: 'auth.passwordChanged' });
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    companyId: string,
  ) {
    const payload = { sub: userId, email, role, companyId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.secret') || '',
        expiresIn: this.config.get('jwt.expiresIn'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret') || '',
        expiresIn: this.config.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
