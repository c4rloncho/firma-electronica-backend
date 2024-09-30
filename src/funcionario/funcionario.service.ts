import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Funcionario } from './entities/funcionario.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Delegate } from './entities/delegado.entity';

@Injectable()
export class FuncionarioService {
  constructor(
    @InjectRepository(Delegate, 'secondConnection')
    private readonly delegateRepository: Repository<Delegate>,
    @InjectRepository(Funcionario, 'default')
    private readonly funcionarioRepository: Repository<Funcionario>,
  ) {}

  async getByRut(rut: string): Promise<Funcionario> {
    if (!rut || rut.trim() === '') {
      throw new BadRequestException('El RUT no puede estar vacío');
    }

    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut },
    });

    if (!funcionario) {
      throw new NotFoundException(`No se encontró funcionario con RUT ${rut}`);
    }

    return funcionario;
  }

  async appointDelegate(ownerRut: string, delegateRut: string): Promise<Delegate> {
    try {
      const [owner, delegate] = await Promise.all([
        this.funcionarioRepository.findOne({ where: { rut: ownerRut } }),
        this.funcionarioRepository.findOne({ where: { rut: delegateRut } }),
      ]);
  
      if (!owner) {
        throw new NotFoundException(`No se encontró un funcionario con RUT ${ownerRut}`);
      }
  
      if (!delegate) {
        throw new NotFoundException(`No se encontró un funcionario con RUT ${delegateRut}`);
      }
  
      const existingDelegate = await this.delegateRepository.findOne({
        where: { ownerRut: ownerRut },
      });
  
      if (existingDelegate) {
        throw new BadRequestException(
          'Solo puedes delegar a una persona. Elimina la anterior para agregar una nueva.',
        );
      }
  
      const newDelegate = this.delegateRepository.create({
        createdAt: new Date(),
        delegateRut: delegateRut,
        ownerRut: ownerRut,
      });
  
      return await this.delegateRepository.save(newDelegate);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        // Re-lanzamos estos errores ya que son manejados específicamente
        throw error;
      } else if (error instanceof QueryFailedError) {
        // Error de base de datos
        throw new InternalServerErrorException('Error al acceder a la base de datos');
      } else {
        // Cualquier otro error no esperado
        throw new InternalServerErrorException('Error inesperado al intentar asignar el delegado');
      }
    }
  }

  
  async deleteDelegate(ownerRut: string, delegateRut: string) {
    const existingDelegate = await this.delegateRepository.findOne({
      where: { ownerRut, delegateRut },
    });

    if (!existingDelegate) {
      throw new NotFoundException({
        success: false,
        message: `No se encontró un delegado con RUT ${delegateRut} para el propietario con RUT ${ownerRut}`,
      });
    }

    const owner = await this.funcionarioRepository.findOne({
      where: { rut: ownerRut },
    });

    if (!owner) {
      throw new NotFoundException({
        success: false,
        message: `No se encontró un funcionario con RUT ${ownerRut}`,
      });
    }

    await this.delegateRepository.remove(existingDelegate);
    
    return {
      success: true,
      message: 'Delegado eliminado correctamente',
    };
  }

  async getDelegates(){
    const delegates = await this.delegateRepository.find()
    return delegates
  }
}
