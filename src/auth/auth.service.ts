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
import { ChangePasswordDto } from './dto/change-password.dto';
import { throwError } from 'rxjs';
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
      select: ['rut', 'nombre', 'password', 'rol'],
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionario no encontrado');
    }

    const isValid = await bcrypt.compare(password, funcionario.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return await this.generateTokens(funcionario);
  }

  async refreshToken(rut: string, refreshToken: string) {
    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
      select: ['rut', 'nombre', 'rol', 'refreshToken'],
    });

    if (!funcionario?.refreshToken) {
      throw new UnauthorizedException('Sesión inválida');
    }

    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_CONSTANT'),
      });
    } catch (error) {
      throw new UnauthorizedException('Token expirado o inválido');
    }
    const isValid = await bcrypt.compare(
      refreshToken,
      funcionario?.refreshToken,
    );
    if (!isValid) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.generateTokens(funcionario);
  }

  private async generateTokens(funcionario: Funcionario) {
    const payload = {
      sub: funcionario.rut,
      nombre: funcionario.nombre,
      rol: funcionario.rol,
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

      const encryptToken = await bcrypt.hash(refreshToken, 10);

      await this.funcionarioRepository.update(
        { rut: funcionario.rut },
        { refreshToken: encryptToken },
      );

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

  async changePassword(input: ChangePasswordDto) {
    const { password, passwordConfirm, rut } = input;

    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
    });
    if (!funcionario) {
      throw new NotFoundException('usuario no encontrado');
    }

    if (password !== passwordConfirm) {
      throw new BadRequestException('contraseñas no coinciden');
    }

    const hashedNewPassword = await bcrypt.hash(password, 10);
    await this.funcionarioRepository.update(rut, {
      password: hashedNewPassword,
    });
    return { message: 'contraseña de usuario actualizada correctamente' };
  }
}
