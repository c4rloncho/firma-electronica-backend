// interfaces/jwt-payload.interface.ts
interface JwtPayload {
    sub: string;      // rut del usuario
  }
  
  // refresh-token.strategy.ts
  import { ExtractJwt, Strategy } from 'passport-jwt';
  import { PassportStrategy } from '@nestjs/passport';
  import { Injectable, UnauthorizedException } from '@nestjs/common';
  import { Request } from 'express';
  import { ConfigService } from '@nestjs/config';
  
  @Injectable()
  export class RefreshTokenStrategy extends PassportStrategy(
    Strategy,
    'jwt-refresh',
  ) {
    constructor(
      private configService: ConfigService, 
    ) {
      super({
        jwtFromRequest: ExtractJwt.fromExtractors([
          (request: Request) => {
            const token = request?.cookies?.refresh_token;
            if (!token) {
              throw new UnauthorizedException('Refresh token no encontrado');
            }
            return token;
          },
        ]),
        ignoreExpiration: false,
        secretOrKey: configService.get('JWT_REFRESH_CONSTANT'),
        passReqToCallback: true,
      });
    }
  
    async validate(req: Request, payload: JwtPayload) {
      try {
        // Validaciones más específicas
        if (!payload.sub) { // sub contendrá el rut
          throw new UnauthorizedException('Token inválido');
        }
  
        // Verifica que el refresh token existe en la cookie
        const refreshToken = req.cookies?.refresh_token;
        if (!refreshToken) {
          throw new UnauthorizedException('Refresh token no encontrado');
        }

        return {
          rut: payload.sub,
          refreshToken, 
        };
      } catch (error) {
        throw new UnauthorizedException('Error al validar refresh token');
      }
    }
  }