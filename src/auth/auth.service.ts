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

    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
      select: ['rut', 'nombre', 'password', 'Privilegio'], // Especificar campos necesarios
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionario no encontrado');
    }

    const hashedPassword = MD5(password).toString();
    if (hashedPassword !== funcionario.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateTokens(funcionario);
  }

  async refreshToken(rut: string, refreshToken: string) {
    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
      select: ['rut', 'nombre', 'Privilegio', 'refreshToken'],
    });

    if (!funcionario?.refreshToken) {
      throw new UnauthorizedException('Sesión inválida');
    }

    // Verificar el refresh token
    try {
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_CONSTANT'),
      });
    } catch {
      throw new UnauthorizedException('Token expirado o inválido');
    }

    if (refreshToken !== funcionario.refreshToken) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.generateTokens(funcionario);
  }

  private async generateTokens(funcionario: Funcionario) {
    const payload = {
      sub: funcionario.rut,
      nombre: funcionario.nombre,
      privilegio: funcionario.Privilegio,
    };

    try {
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

      await this.funcionarioRepository.update(
        { rut: funcionario.rut },
        { refreshToken },
      );

      return {
        access_token: accessToken,
        user: {
          nombre: funcionario.nombre,
          rut: funcionario.rut,
          privilegio: funcionario.Privilegio,
        },
        refresh_token: refreshToken,
      };
    } catch (error) {
      throw new BadRequestException('Error al generar tokens');
    }
  }

  async logout(rut: string) {
    try {
      await this.funcionarioRepository.update({ rut }, { refreshToken: null });
    } catch (error) {
      throw new BadRequestException('Error al cerrar sesión');
    }
  }
}
