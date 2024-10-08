import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Document } from '../documento/entities/document.entity';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

import { Attachment } from './entities/attachment .entity';
import { RemoteStorageService } from 'src/documento/sftp-storage-service';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment,'secondConnection')
    private attachmentRepository: Repository<Attachment>,
    @InjectRepository(Document,'secondConnection')
    private documentRepository: Repository<Document>,
    private remoteStorage:RemoteStorageService,
  ) {}

  private static generateRandomName(): string {
    return Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
  }

  private static getUploadPath(currentYear: string): string {
    const uploadPath = join('./uploads', currentYear);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    return uploadPath;
  }

  private static getStorageOptions() {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const currentYear = new Date().getFullYear().toString();
          const uploadPath = AttachmentService.getUploadPath(currentYear);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = AttachmentService.generateRandomName();
          return cb(null, `attachment_${randomName}${extname(file.originalname)}`);
        },
      }),
    };
  }

  async addAttachment(file: Express.Multer.File, createAttachmentDto: CreateAttachmentDto, rut: string): Promise<Partial<Attachment>> {
    const { documentId , name } = createAttachmentDto;

    const document = await this.documentRepository.findOne({ where: { id: documentId, creatorRut: rut }, relations: ['attachments'] });
    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    const storageOptions = AttachmentService.getStorageOptions();
    const storage = storageOptions.storage as any;

    return new Promise((resolve, reject) => {
      storage.getDestination(null, file, (err, destination) => {
        if (err) return reject(err);

        storage.getFilename(null, file, async (err, filename) => {
          if (err) return reject(err);

          const filePath = join(destination, filename);
          try {
            await fs.promises.writeFile(filePath, file.buffer);

            // Subir al servidor remoto
            const currentYear = new Date().getFullYear().toString();
            const remotePath = `/uploads/${currentYear}/${filename}`;
            await this.remoteStorage.uploadFile(filePath, remotePath);

            const attachment = this.attachmentRepository.create({
              name: name,
              fileName: filename,
              document: document,
              uploadDate: new Date(),
            });

            const savedAttachment = await this.attachmentRepository.save(attachment);
            document.attachments.push(savedAttachment);
            await this.documentRepository.save(document);

            resolve({
              id: savedAttachment.id,
              name: savedAttachment.name,
              fileName: savedAttachment.fileName,
              uploadDate: savedAttachment.uploadDate,
            });
          } catch (error) {
            console.error('Error saving attachment:', error);
            reject(new BadRequestException('Failed to save the file or attachment info'));
          }
        });
      });
    });
  }

  async getAttachments(id: number): Promise<Attachment[]> {
    const attachments = await this.attachmentRepository.find({ where: { document: { id } } });
    if (!attachments || attachments.length === 0) {
      throw new NotFoundException('No se encontraron anexos para este documento');
    }
    return attachments;
  }

  async getAttachment(id:number){
    const attachment = await this.attachmentRepository.findOne({where:{id}});
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
}