import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { Repository } from 'typeorm';
import { Delegate } from './entities/delegado.entity';
import { DocumentSignature } from 'src/documento/entities/document-signature.entity';

@Injectable()
export class DelegateService {
  constructor(
    @InjectRepository(Delegate, 'secondConnection')
    private delegateRepository: Repository<Delegate>,
    @InjectRepository(DocumentSignature, 'secondConnection')
    private documentSignatureRepository: Repository<DocumentSignature>,
    @InjectRepository(Funcionario, 'default')
    private funcionarioRepository: Repository<Funcionario>,
  ) {}

  async getDelegates() {
    const delegates = await this.delegateRepository.find({
      where: { isDeleted: false },
    });
    return delegates;
  }

  async appointDelegate(
    ownerRut: string,
    delegateRut: string,
  ): Promise<Delegate> {
    try {
      const [owner, delegate] = await Promise.all([
        this.funcionarioRepository.findOne({ where: { rut: ownerRut } }),
        this.funcionarioRepository.findOne({ where: { rut: delegateRut } }),
      ]);

      if (!owner) {
        throw new NotFoundException(
          `No se encontró un funcionario con RUT ${ownerRut}`,
        );
      }

      if (!delegate) {
        throw new NotFoundException(
          `No se encontró un funcionario con RUT ${delegateRut}`,
        );
      }

      const existingDelegate = await this.delegateRepository.findOne({
        where: { ownerRut: ownerRut, isDeleted: false },
      });

      if (existingDelegate) {
        throw new BadRequestException(
          'Solo puedes delegar a una persona. Elimina la anterior para agregar una nueva.',
        );
      }

      let pendingDelegate = await this.delegateRepository.findOne({
        where: {
          ownerRut: ownerRut,
          delegateRut: delegateRut,
          isDeleted: true,
        },
      });

      if (!pendingDelegate) {
        pendingDelegate = this.delegateRepository.create({
          createdAt: new Date(),
          delegateRut: delegateRut,
          ownerRut: ownerRut,
        });
      } else {
        pendingDelegate.createdAt = new Date(); // Actualizamos la fecha de creación
      }

      pendingDelegate.isDeleted = false;

      return await this.delegateRepository.save(pendingDelegate);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      } else {
        throw new InternalServerErrorException(
          'Error inesperado al intentar asignar el delegado',
        );
      }
    }
  }

  async softDeleteDelegate(ownerRut: string) {
    const existingDelegate = await this.delegateRepository.findOne({
      where: { ownerRut, isDeleted: false },
    });

    if (!existingDelegate) {
      throw new NotFoundException({
        success: false,
        message: `No se encontró un delegado activo para el RUT ${ownerRut}`,
      });
    }

    existingDelegate.isDeleted = true;
    existingDelegate.isActive = false;
    await this.delegateRepository.save(existingDelegate);

    return {
      success: true,
      message: 'Delegado eliminado (soft delete) correctamente',
    };
  }

  async activateDelegate(ownerRut: string): Promise<{message:string,delegate:Delegate}> {
    const delegate = await this.delegateRepository.findOne({
      where: { ownerRut, isDeleted: false },
    });

    if (!delegate) {
      throw new NotFoundException('Delegado no encontrado');
    }

    if (delegate.isActive) {
      throw new BadRequestException('El delegado ya está activo');
    }

    delegate.isActive = true;
    delegate.expiresAt = null;
    const delegateUpdated = await this.delegateRepository.save(delegate);
    return {message: 'Delegado activado correctamente', delegate: delegateUpdated};
  }

  async deactivateDelegate(ownerRut: string): Promise<Delegate> {
    const delegate = await this.delegateRepository.findOne({
      where: { ownerRut, isDeleted: false },
    });

    if (!delegate) {
      throw new NotFoundException('Delegado no encontrado');
    }

    if (!delegate.isActive) {
      throw new BadRequestException('El delegado ya está inactivo');
    }

    delegate.isActive = false;
    return await this.delegateRepository.save(delegate);
  }
 
}
