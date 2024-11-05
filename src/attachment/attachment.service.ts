import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Document } from '../documento/entities/document.entity';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

import { Attachment } from './entities/attachment.entity';
import { RemoteStorageService } from 'src/documento/sftp-storage-service';
import { query } from 'express';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment, 'secondConnection')
    private attachmentRepository: Repository<Attachment>,
    @InjectRepository(Document, 'secondConnection')
    private documentRepository: Repository<Document>,
    private remoteStorage: RemoteStorageService,
    @InjectDataSource('secondConnection')
    private dataSource: DataSource,
  ) {}

  private static generateRandomName(): string {
    return Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
  }

  async addAttachment(
    file: Express.Multer.File,
    createAttachmentDto: CreateAttachmentDto,
    rut: string,
  ): Promise<Partial<Attachment>> {
    const { documentId, name } = createAttachmentDto;

    const document = await this.documentRepository.findOne({
      where: { id: documentId, creatorRut: rut },
      relations: ['attachments'],
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    const currentYear = new Date().getFullYear().toString();
    const randomName = AttachmentService.generateRandomName();
    const filename = `attachment_${randomName}${extname(file.originalname)}`;
    const remotePath = `/uploads/${currentYear}/${filename}`;

    // Iniciar una transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Subir al servidor remoto
      await this.remoteStorage.uploadFile(file.buffer, remotePath);

      const attachment = this.attachmentRepository.create({
        name: name,
        fileName: filename,
        document: document,
        remoteFilePath: remotePath,
      });
      attachment.document = document;
      const savedAttachment = await queryRunner.manager.save(attachment);

      if (!document.attachments) {
        document.attachments = [];
      }
      document.attachments.push(savedAttachment);
      await queryRunner.manager.save(document);

      // Si todo va bien, confirmar la transacción
      await queryRunner.commitTransaction();

      return {
        id: savedAttachment.id,
        name: savedAttachment.name,
        fileName: savedAttachment.fileName,
        uploadDate: savedAttachment.uploadDate,
        remoteFilePath: savedAttachment.remoteFilePath,
      };
    } catch (error) {
      // Si algo sale mal, revertir la transacción
      await queryRunner.rollbackTransaction();

      // Intentar eliminar el archivo del servidor remoto si se subió
      try {
        await this.remoteStorage.deleteFile(remotePath);
      } catch (deleteError) {
        console.error(
          'Error deleting remote file after database failure:',
          deleteError,
        );
      }

      console.error('Error saving attachment:', error);
      throw new InternalServerErrorException(
        'Failed to save the file or attachment info',
      );
    } finally {
      // Liberar el queryRunner
      await queryRunner.release();
    }
  }
  async getAttachments(id: number): Promise<
    {
      id: number;
      name: string;
      createdAt: Date;
    }[]
  > {
    const attachments = await this.attachmentRepository.find({
      where: { document: { id } },
    });
    if (!attachments || attachments.length === 0) {
      throw new NotFoundException(
        'No se encontraron anexos para este documento',
      );
    }
    const data = attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      createdAt: attachment.uploadDate,
    }));
    return data;
  }

  async getAttachment(id: number) {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException(`Anexo con ID ${id} no encontrado`);
    }

    const dateObject = new Date(attachment.uploadDate);
    const documentYear = dateObject.getFullYear().toString();
    const filePath = `./uploads/${documentYear}/${attachment.fileName}`;
    return {
      ...attachment,
      filePath,
    };
  }

  async deleteAttachment(rut: string, id: number) {
    // 1. Primero buscar el attachment
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
      relations: ['document'],
    });

    // 2. Validaciones primero
    if (!attachment) {
      throw new NotFoundException('Anexo no encontrado');
    }

    if (attachment.document.creatorRut !== rut) {
      throw new UnauthorizedException(
        'Solo el usuario que creó puede eliminar el anexo',
      );
    }

    // 3. Preparar datos
    const dateObject = new Date(attachment.uploadDate);
    const documentYear = dateObject.getFullYear().toString();
    const filePath = `./uploads/${documentYear}/${attachment.fileName}`;

    // 4. Manejo de transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.remove(attachment);
      await this.remoteStorage.deleteFile(filePath);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Error al eliminar el anexo');
    } finally {
      await queryRunner.release();
    }

    return { message: 'Anexo eliminado correctamente' };
  }
}
