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
import { access } from 'fs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { createHash } from 'crypto';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Funcionario,'default')
    private readonly funcionarioRepository: Repository<Funcionario>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Método principal de login
  async validateEmployee(input: LoginDto) {
    const { rut, password } = input;
    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
    });

    if (!funcionario) {
      throw new NotFoundException('Funcionario no encontrado');
    }

    const hashedPassword = MD5(password).toString();
    if (hashedPassword !== funcionario.password) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    // En lugar de generar tokens aquí, usar el método común
    return this.generateTokens(funcionario);
  }

  // Método de refresh mejorado con await en el update
  async refreshToken(rut: string, refreshToken: string) {
    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
    });

    if (!funcionario || !funcionario.refreshToken) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (refreshToken !== funcionario.refreshToken) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.generateTokens(funcionario);
  }

  // Método común para generar tokens
  async generateTokens(funcionario: Funcionario) {
    const payload = {
      sub: funcionario.rut,
      nombre: funcionario.nombre,
      privilegio: funcionario.Privilegio,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_CONSTANT'),
        expiresIn: '1h',  // Usando un tiempo más corto para access token
      }),
      
      this.jwtService.signAsync(
        { sub: funcionario.rut },
        {
          secret: this.configService.get('JWT_REFRESH_CONSTANT'),
          expiresIn: '7d',
        },
      ),
    ]);

    // Importante: esperar a que se complete el update
    await this.funcionarioRepository.update(
      { rut: funcionario.rut },
      { refreshToken }
    );
    console.log(accessToken)
    return {
      access_token: accessToken,
      user:{nombre:funcionario.nombre,rut:funcionario.rut},
      refresh_token: refreshToken,
    };
  }

  // Agregar método de logout
  async logout(rut: string) {
    await this.funcionarioRepository.update(
      { rut },
      { refreshToken: null }
    );
  }
}