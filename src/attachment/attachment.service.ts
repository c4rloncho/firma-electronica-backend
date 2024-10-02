import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../documento/entities/document.entity';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { Attachment } from './entities/attachment .entity';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment,'secondConnection')
    private attachmentRepository: Repository<Attachment>,
    @InjectRepository(Document,'secondConnection')
    private documentRepository: Repository<Document>
  ) {}

  static getStorageOptions() {
    return {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const currentYear = new Date().getFullYear().toString();
          const uploadPath = join('./uploads', currentYear);
          
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `attachment_${randomName}${extname(file.originalname)}`);
        },
      }),
    };
  }

  async addAttachment(file: Express.Multer.File, createAttachmentDto: CreateAttachmentDto): Promise<Attachment> {
    const { documentId, name } = createAttachmentDto;

    // Verificar si el documento existe
    const document = await this.documentRepository.findOne({where: {id: documentId}});
    if (!document) {
      throw new NotFoundException(`Document with ID ${documentId} not found`);
    }

    // Usar las opciones de almacenamiento para guardar el archivo
    const storageOptions = AttachmentService.getStorageOptions();
    const storage = storageOptions.storage as any;

    return new Promise((resolve, reject) => {
      storage.getDestination(null, file, (err, destination) => {
        if (err) return reject(err);

        storage.getFilename(null, file, (err, filename) => {
          if (err) return reject(err);

          const filePath = join(destination, filename);

          fs.writeFile(filePath, file.buffer, async (err) => {
            if (err) return reject(new BadRequestException('Failed to save the file'));

            // Crear y guardar el attachment en la base de datos
            const attachment = this.attachmentRepository.create({
              name: name ,
              fileName: filename,
              document: document,
              uploadDate: new Date()
            });
           

            try {
              const savedAttachment = await this.attachmentRepository.save(attachment);
               //asociacion
                document.attachments.push(savedAttachment);
                await this.documentRepository.save(document) ;
              resolve(savedAttachment);
            } catch (error) {
              reject(new BadRequestException('Failed to save attachment info to database'));
            }
          });
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
    return attachment;
  }
}