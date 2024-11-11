import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Funcionario } from './entities/funcionario.entity';
import { ILike, Like, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FuncionarioResponse } from './dto/funcionario-responde.dto';
import { RegisterFuncionarioDto } from './dto/register-funcionario.dto';
import { Rol } from 'src/enums/rol.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class FuncionarioService {
  constructor(
    @InjectRepository(Funcionario, 'default')
    private readonly funcionarioRepository: Repository<Funcionario>,
  ) {}

  async searchFuncionarios(query: string): Promise<FuncionarioResponse[]> {
    const funcionarios = await this.funcionarioRepository.find({
      where: [{ rut: Like(`%${query}%`) }, { nombre: ILike(`%${query}%`) }],
      take: 20, // Limita los resultados a 10 para evitar sobrecarga
    });

    const response: FuncionarioResponse[] = funcionarios.map((f) => ({
      rut: f.rut,
      nombre: f.nombre,
    }));

    return response;
  }

  async registerFuncionario(input: RegisterFuncionarioDto) {
    try {
      const funcionarioExistente = await this.funcionarioRepository.findOne({
        where: { rut: input.rut },
      });

      if (funcionarioExistente) {
        throw new BadRequestException('Este funcionario ya está registrado');
      }

      // Hashear password
      const hashedPassword = await bcrypt.hash(input.password, 10);

      // Crear el funcionario
      const funcionario = this.funcionarioRepository.create({
        rol: Rol.USER,
        cargo: input.cargo,
        activo: true,
        nombre: input.name,
        rut: input.rut,
        password: hashedPassword,
      });

      // Guardar funcionario
      await this.funcionarioRepository.save(funcionario);

      return {
        message: 'Funcionario creado exitosamente',
        success: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log del error real
      console.error('Error al registrar funcionario:', error);
      throw new InternalServerErrorException(
        'Error al registrar el funcionario',
      );
    }
  }

  
}
