import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    // passport-jwt's overloads do not narrow correctly through PassportStrategy.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret') || '',
      passReqToCallback: true,
    } as any);
  }

  async validate(req: Request, payload: { sub: string }) {
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        companyId: true,
        role: true,
        refreshTokenHash: true,
        status: true,
      },
    });

    if (!user || !user.refreshTokenHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    if (!refreshToken)
      throw new UnauthorizedException('Refresh token required');

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Refresh token invalid');

    return user;
  }
}
