import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateTypeDocumentDto } from './dto/create-type-document.dto';
import { UpdateTypeDocumentDto } from './dto/update-type-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeDocument } from './entities/type-document.entity';
import { ILike, Repository } from 'typeorm';
import { NotFoundError } from 'rxjs';

@Injectable()
export class TypeDocumentService {
  constructor(
    @InjectRepository(TypeDocument)
    private readonly typeDocumentRepository: Repository<TypeDocument>,
  ) {}
  async create(input: CreateTypeDocumentDto) {
    let typeDocument = await this.typeDocumentRepository.findOne({
      where: { name: input.name },
      withDeleted: true,
    });

    if (typeDocument?.deletedAt) {
      //hacer restore
      await this.typeDocumentRepository.restore(typeDocument.id);
      return {
        success: true,
        message: 'Tipo de documento creado exitosamente',
        data: typeDocument,
      };
    }
    if (typeDocument) {
      throw new BadRequestException(
        'Ya existe este nombre para tipo de documento',
      );
    }

    typeDocument = this.typeDocumentRepository.create({
      name: input.name,
    });

    const savedTypeDocument =
      await this.typeDocumentRepository.save(typeDocument);

    return {
      success: true,
      message: 'Tipo de documento creado exitosamente',
      data: savedTypeDocument,
    };
  }

  async getAll(name?: string, limit: number = 20) {
    try {
      let whereCondition = {};

      // Solo aplicar el filtro de nombre si se proporciona
      if (name) {
        whereCondition = { name: ILike(`%${name}%`) };
      }

      const typesDocument = await this.typeDocumentRepository.find({
        where: whereCondition,
        take: Math.min(limit, 100), // Limita el máximo a 100 registros
      });

      if (typesDocument.length === 0) {
        throw new NotFoundException('No se encontraron tipos de documentos');
      }

      return typesDocument;
    } catch (error) {
      // Manejo específico de errores
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al buscar tipos de documentos',
      );
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} typeDocument`;
  }

  update(id: number, updateTypeDocumentDto: UpdateTypeDocumentDto) {
    return `This action updates a #${id} typeDocument`;
  }

  async remove(id: number) {
    const typeDocument = await this.typeDocumentRepository.findOne({
      where: { id: id },
    });
    if (!typeDocument) {
      throw new NotFoundException('tipo de documento no encontrado');
    }
    await this.typeDocumentRepository.softDelete(id);
    return { message: 'Tipo de documento eliminado exitosamente' };
  }
}
