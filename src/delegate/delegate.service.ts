import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { IsNull, Not, Repository } from 'typeorm';
import { Delegate } from './entities/delegado.entity';
import { DocumentSignature } from 'src/documento/entities/document-signature.entity';

@Injectable()
export class DelegateService {
  constructor(
    @InjectRepository(Delegate)
    private delegateRepository: Repository<Delegate>,
    @InjectRepository(DocumentSignature)
    private documentSignatureRepository: Repository<DocumentSignature>,
    @InjectRepository(Funcionario)
    private funcionarioRepository: Repository<Funcionario>,
  ) {}
  /**
   * Obtiene todos los delegados no eliminados.
   * @returns Una promesa que resuelve a un array de delegados.
   */
  async getDelegates() {
    const delegates = await this.delegateRepository.find();
    return delegates;
  }
  /**
   * Asigna un nuevo delegado.
   * @param ownerRut RUT del titular.
   * @param delegateRut RUT del delegado.
   * @returns Una promesa que resuelve al delegado creado o actualizado.
   * @throws NotFoundException si no se encuentra el propietario o el delegado.
   * @throws BadRequestException si ya existe un delegado activo.
   * @throws InternalServerErrorException para otros errores inesperados.
   */
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
      if (ownerRut === delegateRut) {
        throw new BadRequestException(
          'No puedes seleccionarte a ti mismo como delegado',
        );
      }

      if (!delegate) {
        throw new NotFoundException(
          `No se encontró un funcionario con RUT ${delegateRut}`,
        );
      }

      const existingDelegate = await this.delegateRepository.findOne({
        where: { ownerRut: ownerRut },
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
          deletedAt: Not(IsNull()),
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

      pendingDelegate.deletedAt = null;

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
  /**
   * Realiza un soft delete de un delegado.
   * @param ownerRut rut del titular.
   * @returns Un objeto con el resultado de la operación.
   * @throws NotFoundException si no se encuentra un delegado activo.
   */
  async softDeleteDelegate(ownerRut: string) {
    const existingDelegate = await this.delegateRepository.findOne({
      where: { ownerRut },
    });

    if (!existingDelegate) {
      throw new NotFoundException({
        success: false,
        message: `No se encontró un delegado activo para el RUT ${ownerRut}`,
      });
    }
    await this.delegateRepository.update(existingDelegate.id, {
      isActive: false,
    });
    await this.delegateRepository.softDelete(existingDelegate.id);

    return {
      success: true,
      message: 'Delegado eliminado (soft delete) correctamente',
    };
  }
  /**
   * Activa un delegado.
   * @param ownerRut RUT del titular.
   * @returns Un objeto con un mensaje y el delegado actualizado.
   * @throws NotFoundException si no se encuentra el delegado.
   * @throws BadRequestException si el delegado ya está activo.
   */
  async activateDelegate(
    ownerRut: string,
  ): Promise<{ message: string; delegate: Delegate }> {
    const delegate = await this.delegateRepository.findOne({
      where: { ownerRut },
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
    return {
      message: 'Delegado activado correctamente',
      delegate: delegateUpdated,
    };
  }

  /**
   * Desactiva un delegado.
   * @param ownerRut RUT del titular.
   * @returns El delegado actualizado.
   * @throws NotFoundException si no se encuentra el delegado.
   * @throws BadRequestException si el delegado ya está inactivo.
   */
  async deactivateDelegate(ownerRut: string): Promise<Delegate> {
    const delegate = await this.delegateRepository.findOne({
      where: { ownerRut, deletedAt: IsNull() },
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

  /**
   * Obtiene un delegado por el RUT del propietario.
   * @param rut RUT del propietario.
   * @returns El delegado encontrado.
   * @throws NotFoundException si no se encuentra el delegado.
   */
  async getDelegatesRut(rut: string): Promise<Delegate & { nombre: string }> {
    const delegate = await this.delegateRepository.findOne({
      where: { ownerRut: rut },
    });

    if (!delegate) {
      throw new NotFoundException('No tienes un delegado');
    }
    const funcionario = await this.funcionarioRepository.findOne({
      where: { rut: delegate.delegateRut },
    });

    return { ...delegate, nombre: funcionario.nombre };
  }
}
