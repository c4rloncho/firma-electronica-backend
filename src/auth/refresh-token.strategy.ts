interface JwtPayload {
  sub: string;      
}

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
  console.log('1. [RefreshTokenStrategy] 🚀 Iniciando construcción de estrategia');
  super({
    jwtFromRequest: ExtractJwt.fromExtractors([
      (request: Request) => {
        console.log('2. [RefreshTokenStrategy] 🔍 Buscando refresh token en cookies');
        const token = request?.cookies?.refresh_token;
        
        if (!token) {
          console.error('❌ [RefreshTokenStrategy] Cookie refresh_token no encontrada');
          throw new UnauthorizedException('Refresh token no encontrado');
        }

        console.log('3. [RefreshTokenStrategy] ✅ Token encontrado en cookies:', {
          tokenLength: token.length,
          tokenStart: token.substring(0, 20) + '...'
        });
        
        return token;
      },
    ]),
    ignoreExpiration: false,
    secretOrKey: configService.get('JWT_REFRESH_CONSTANT'),
    passReqToCallback: true,
  });
  console.log('4. [RefreshTokenStrategy] ✨ Estrategia construida exitosamente');
}

async validate(req: Request, payload: JwtPayload) {
  console.log('5. [RefreshTokenStrategy] 🔄 Iniciando validación', {
    payloadExists: !!payload,
    subExists: !!payload?.sub,
    cookieExists: !!req.cookies?.refresh_token
  });

  try {
    // Validar payload
    if (!payload.sub) {
      console.error('6. ❌ [RefreshTokenStrategy] Payload inválido - sub no encontrado');
      throw new UnauthorizedException('Token inválido');
    }

    console.log('7. [RefreshTokenStrategy] ✅ Payload validado:', {
      sub: payload.sub
    });

    // Validar refresh token en cookie
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      console.error('8. ❌ [RefreshTokenStrategy] Token no encontrado en cookies');
      throw new UnauthorizedException('Refresh token no encontrado');
    }

    console.log('9. [RefreshTokenStrategy] ✅ Token en cookies validado:', {
      tokenLength: refreshToken.length,
      tokenStart: refreshToken.substring(0, 20) + '...'
    });

    // Preparar resultado
    const result = {
      rut: payload.sub,
      refreshToken
    };

    console.log('10. [RefreshTokenStrategy] 🎉 Validación exitosa:', {
      rut: payload.sub,
      tokenLength: refreshToken.length
    });

    return result;

  } catch (error) {
    console.error('❌ [RefreshTokenStrategy] Error en validación:', {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    });
    throw new UnauthorizedException('Error al validar refresh token');
  }
}
}