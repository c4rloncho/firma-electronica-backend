import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Funcionario } from './entities/funcionario.entity';
import { ILike, QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { FuncionarioResponse } from './dto/funcionario-responde.dto';

@Injectable()
export class FuncionarioService {
  constructor(
    @InjectRepository(Funcionario, 'default')
    private readonly funcionarioRepository: Repository<Funcionario>,
  ) {}

  async searchFuncionarios(query: string): Promise<FuncionarioResponse[]> {
    const funcionarios = await this.funcionarioRepository.find({
      where: [
        { rut: query },
        { nombre: ILike(`%${query}%`) },
      ],
      take: 10, // Limita los resultados a 10 para evitar sobrecarga
    });
    const response:FuncionarioResponse[] =  funcionarios.map((f)=>{
      console.log(funcionarios[0])
      return {
        rut:f.rut,
        nombre:f.nombre,
      }
    })
    return response
  }

}
