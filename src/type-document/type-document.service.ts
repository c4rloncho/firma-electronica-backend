import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTypeDocumentDto } from './dto/create-type-document.dto';
import { UpdateTypeDocumentDto } from './dto/update-type-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeDocument } from './entities/type-document.entity';
import { Repository } from 'typeorm';
import { NotFoundError } from 'rxjs';

@Injectable()
export class TypeDocumentService {
  constructor(
    @InjectRepository(TypeDocument)
    private readonly typeDocumentRepository:Repository<TypeDocument>,
  ){}
  async create(input: CreateTypeDocumentDto) {
    let typeDocument = await this.typeDocumentRepository.findOne({
      where: { name: input.name }
    });

    if (typeDocument) {
      throw new BadRequestException('Ya existe este nombre para tipo de documento');
    }

    typeDocument = this.typeDocumentRepository.create({
      name: input.name
    });

    const savedTypeDocument = await this.typeDocumentRepository.save(typeDocument);

    return {
      success: true,
      message: 'Tipo de documento creado exitosamente',
      data: savedTypeDocument
    };
  }

  findAll() {
    return `This action returns all typeDocument`;
  }

  findOne(id: number) {
    return `This action returns a #${id} typeDocument`;
  }

  update(id: number, updateTypeDocumentDto: UpdateTypeDocumentDto) {
    return `This action updates a #${id} typeDocument`;
  }

  async remove(id: number) {
    const typeDocument = await this.typeDocumentRepository.findOne({where:{id:id}});
    if(!typeDocument){
      throw new NotFoundException('tipo de documento no encontrado');
    }
    await this.typeDocumentRepository.remove(typeDocument);
    return { message: 'Tipo de documento eliminado exitosamente' };
  }
}
