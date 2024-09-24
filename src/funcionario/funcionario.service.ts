import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Funcionario } from './entities/funcionario.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class FuncionarioService {
    constructor(
        @InjectRepository(Funcionario)
        private readonly funcionarioRepository:Repository<Funcionario>
    ){}


    async getByRut(rut: string): Promise<Funcionario> {
        if (!rut || rut.trim() === '') {
          throw new BadRequestException('El RUT no puede estar vacío');
        }
      
        const funcionario = await this.funcionarioRepository.findOne({ where: { rut } });
      
        if (!funcionario) {
          throw new NotFoundException(`No se encontró funcionario con RUT ${rut}`);
        }
      
        return funcionario;
      }
}
