import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
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
      throw new BadRequestException('Contraseña incorrecta');
    }

    const payload = { rut: funcionario.rut, name: funcionario.nombre,privilegio:funcionario.Privilegio };
    const expiresIn = this.configService.get<string>('JWT_EXPIRATION');

    return {
      access_token: this.jwtService.sign(payload),
      expiresIn:expiresIn,
    };
  }



  // async registerEmployee(input: RegisterDto) {
  //   const { nombre, rut, correo, password,privilegio } = input;
  //   const existFuncionario = await this.funcionarioRepository.findOne({
  //     where: { rut },
  //   });
  //   if (existFuncionario) {
  //     throw new BadRequestException('error RUT ya registrado');
  //   }
  //   const hashedPassword = createHash('md5').update(password).digest('hex');
  //   const newFuncionario = this.funcionarioRepository.create({
  //     rut,
  //     nombre,
  //     correo,
  //     activo:1,
  //     password: hashedPassword,
  //     Privilegio: privilegio
  //   });
  //   this.funcionarioRepository.save(newFuncionario);
  //   return {message:'Usuario registrado exitosamente'}
  // }
}
