import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { MD5 } from 'crypto-js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Funcionario, 'default')
    private readonly funcionarioRepository: Repository<Funcionario>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateEmployee(input: LoginDto) {
    const { rut, password } = input;
    console.log('=== INICIO LOGIN ===');
    console.log('Login iniciado para rut:', rut);

    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
      select: ['rut', 'nombre', 'password', 'rol'], 
    });

    if (!funcionario) {
      console.log('❌ Funcionario no encontrado:', rut);
      throw new NotFoundException('Funcionario no encontrado');
    }
    console.log('✅ Funcionario encontrado:', { rut, nombre: funcionario.nombre });

    const isValid = await bcrypt.compare(password,funcionario.password);
    if (!isValid) {
      console.log('❌ Password inválido para:', rut);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    console.log('✅ Password validado correctamente');
    
    console.log('=== FIN LOGIN - INICIANDO GENERACIÓN DE TOKENS ===');
    return await this.generateTokens(funcionario);
  }

  async refreshToken(rut: string, refreshToken: string) {
    console.log('=== INICIO REFRESH ===');
    console.log('1. Iniciando refreshToken con:', { 
      rut, 
      tokenLength: refreshToken?.length,
      tokenPrimeros20: refreshToken?.substring(0, 20)
    });

    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
      select: ['rut', 'nombre', 'rol', 'refreshToken'],
    });

    console.log('2. Funcionario encontrado:', { 
      encontrado: !!funcionario,
      tieneRefreshToken: !!funcionario?.refreshToken,
      tokenBDPrimeros20: funcionario?.refreshToken?.substring(0, 20)
    });

    if (!funcionario?.refreshToken) {
      console.log('❌ No hay refresh token en BD');
      throw new UnauthorizedException('Sesión inválida');
    }

    try {
      console.log('3. Verificando JWT');
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_CONSTANT'),
      });
      console.log('4. JWT verificado correctamente:', {
        sub: decoded.sub,
        exp: decoded.exp
      });
    } catch (error) {
      console.log('❌ Error verificando JWT:', {
        mensaje: error.message,
        tipo: error.name
      });
      throw new UnauthorizedException('Token expirado o inválido');
    }

    console.log('5. Comparando tokens:', {    
      tokenRecibidoUltimos20: refreshToken.slice(-20),
      tokenBDUltimos20: funcionario.refreshToken.slice(-20),
      sonIguales: refreshToken === funcionario.refreshToken
    });
    
    if (refreshToken !== funcionario.refreshToken) {
      throw new UnauthorizedException('Token inválido');
    }

    if (refreshToken !== funcionario.refreshToken) {
      console.log('❌ Los tokens no coinciden');
      console.log('Token recibido (últimos 20):', refreshToken.slice(-20));
      console.log('Token almacenado (últimos 20):', funcionario.refreshToken.slice(-20));
      throw new UnauthorizedException('Token inválido');
    }

    console.log('6. ✅ Tokens coinciden, generando nuevos tokens');
    return this.generateTokens(funcionario);
  }

  private async generateTokens(funcionario: Funcionario) {
    console.log('=== GENERANDO TOKENS ===');
    console.log('7. Iniciando generateTokens para:', funcionario.rut);
    const payload = {
      sub: funcionario.rut,
      nombre: funcionario.nombre,
      rol: funcionario.rol,
    };
    try {
      console.log('8. Generando nuevos tokens');
      const [accessToken, refreshToken] = await Promise.all([
        this.jwtService.signAsync(payload, {
          secret: this.configService.get('JWT_CONSTANT'),
          expiresIn: '1h',
        }),
        this.jwtService.signAsync(
          { sub: funcionario.rut },
          {
            secret: this.configService.get('JWT_REFRESH_CONSTANT'),
            expiresIn: '7d',
          },
        ),
      ]);

      console.log('9. Tokens generados:', {
         accessTokenUltimos20: accessToken.slice(-20),
         refreshTokenUltimos20: refreshToken.slice(-20)
      });

      console.log('10. Actualizando refresh token en BD para:', funcionario.rut);
      await this.funcionarioRepository.update(
        { rut: funcionario.rut },
        { refreshToken },
      );

      console.log('✅ Tokens actualizados correctamente');
      console.log('=== FIN GENERACIÓN TOKENS ===');
      
      return {
        access_token: accessToken,
        user: {
          nombre: funcionario.nombre,
          rut: funcionario.rut,
          rol: funcionario.rol,
        },
        refresh_token: refreshToken,
      };
    } catch (error) {
      console.log('❌ Error en generateTokens:', {
        mensaje: error.message,
        tipo: error.name
      });
      throw new BadRequestException('Error al generar tokens');
    }
  }

  async logout(rut: string) {
    try {
      console.log('Iniciando logout en servicio para rut:', rut);
      
      await this.funcionarioRepository.update({ rut }, { refreshToken: null });
      console.log('RefreshToken eliminado exitosamente de la base de datos');
      
    } catch (error) {
      console.error('Error en el servicio de logout:', error);
      throw new BadRequestException('Error al cerrar sesión');
    }
  }
}
