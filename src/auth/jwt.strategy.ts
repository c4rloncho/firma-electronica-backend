import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(request: Request) => {
        return request?.cookies?.access_token;
      }]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_CONSTANT,
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }
    return { rut: payload.rut, name: payload.nombre,privilegio:payload.privilegio };
  }
}