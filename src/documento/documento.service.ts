import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature, SignerType } from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { FirmaService } from 'src/firma/firma.service';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

@Injectable()
export class DocumentoService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentSignature)
    private readonly documentSignatureRepository: Repository<DocumentSignature>,
    private firmaService: FirmaService,
    private entityManager:EntityManager,
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
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    };
  }

  async createDocument(
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    return this.documentRepository.manager.transaction(async transactionalEntityManager => {
      const { name, signers } = createDocumentDto;
  
      const document = transactionalEntityManager.create(Document, {
        name,
        fileName: file.filename,
        date: new Date(),
      });
      await transactionalEntityManager.save(document);
  
      const signatures = signers.map((signer: SignerDto) =>
        transactionalEntityManager.create(DocumentSignature, {
          document,
          signerRut: signer.rut,
          signerOrder: signer.order,
          signerType: signer.type,
        }),
      );
      await transactionalEntityManager.save(signatures);
  
      return document;
    });
  }

  async signDocument(input: SignDocumentDto, imageBuffer: Express.Multer.File) {
    const { documentId, run } = input;
    const document = await this.documentRepository.findOne({
      where: { id: parseInt(documentId) },
      relations: ['signatures'],
    });
  
    if (!document) {
      throw new NotFoundException(`Documento con el id ${documentId} no encontrado`);
    }
  
    const pendingSignature = document.signatures.find(
      (s) => !s.isSigned && s.signerRut === run
    );
  
    if (!pendingSignature) {
      throw new BadRequestException('No corresponde firmar o ya firmó');
    }
  
    this.validateSignatureOrder(document.signatures, pendingSignature);
  
    return await this.entityManager.transaction(async (transactionalEntityManager) => {
      try {
        const dateObject = new Date(document.date);
        const documentYear = dateObject.getFullYear().toString();
       

        const { content, checksum } = await this.prepareFile(document.fileName,documentYear);
        
        // Llamada al servicio de firma
        const firmaResult = await this.firmaService.signdocument({
          ...input,
          documentContent: content,
          documentChecksum: checksum
        }, imageBuffer);
  
        if (firmaResult.success) {
          pendingSignature.isSigned = true;
          pendingSignature.signedAt = new Date();
          await transactionalEntityManager.save(pendingSignature);
  
          // Verificar si el documento está completamente firmado
          const allSigned = document.signatures.every(s => s.isSigned);
          if (allSigned) {
            document.isFullySigned = true;
            await transactionalEntityManager.save(document);
          }
  
          
          return { 
            message: 'Documento firmado exitosamente',
            signature: pendingSignature,
            firmaInfo: firmaResult.signatureInfo
          };
        } else {
          throw new BadRequestException('La firma digital no se pudo completar');
        }
      } catch (error) {
        throw new BadRequestException(`Error al firmar el documento: ${error.message}`);
      }
    });
  }
  private validateSignatureOrder(signatures: DocumentSignature[], currentSignature: DocumentSignature) {

    const previousSignatures = signatures.filter(
      (s) => s.signerOrder < currentSignature.signerOrder && s.signerType === currentSignature.signerType
    );
    
    if (previousSignatures.some((s) => !s.isSigned)) {
      throw new BadRequestException('Hay firmas pendientes de su mismo tipo con orden anterior');
    }

    if (currentSignature.signerType === SignerType.FIRMADOR) {
      const allVisadores = signatures.filter((s) => s.signerType === SignerType.VISADOR);
      console.log(allVisadores.length)
      if (allVisadores.some((s) => !s.isSigned)) {
        throw new BadRequestException('Todos los visadores deben firmar antes que los firmadores');
      }
    }
  }
  
  private async prepareFile(fileName: string,year:string): Promise<{ content: string, checksum: string }> {
    const filePath = `./uploads/${year}/${fileName}`;
    const fileBuffer = await fsp.readFile(filePath);
    const content = fileBuffer.toString('base64');
    const checksum = this.calculateChecksum(fileBuffer);
    return { content, checksum };
  }


  async getById(id: number) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Documento no encontrado con id ${id}`);
    }
    
    const year = document.date.getFullYear();
    return {
      ...document,
      filePath: `./uploads/${year}/${document.fileName}`
    };
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  async getPendingSignatures(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string
  ): Promise<{ 
    data: { id: number; name: string; fileName: string; typeSign: string }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let query = this.documentRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.signatures', 'signature')
      .select([
        'document.id',
        'document.name',
        'document.fileName',
        'signature.signerType'
      ])
      .where('signature.signerRut = :rut', { rut })
      .andWhere('signature.isSigned = :isSigned', { isSigned: false })
      .andWhere('document.isFullySigned = :isFullySigned', { isFullySigned: false });
  
    if (startDate && endDate) {
      query = query.andWhere('document.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }
  
    if (documentName) {
      query = query.andWhere('document.name LIKE :name', { name: `%${documentName}%` });
    }
  
    const [documentos, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  
    const data = documentos.map(doc => ({
      id: doc.id,
      name: doc.name,
      fileName: doc.fileName,
      typeSign: doc.signatures[0]?.signerType || 'desconocido'
    }));
  
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllDocumentsByRut(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string
  ): Promise<{
    data: { id: number; name: string; fileName: string; typeSign: string; isSigned: boolean; isFullySigned: boolean }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let query = this.documentRepository.createQueryBuilder('document')
      .leftJoinAndSelect('document.signatures', 'signature', 'signature.signerRut = :rut', { rut })
      .select([
        'document.id',
        'document.name',
        'document.fileName',
        'document.isFullySigned',
        'signature.signerType',
        'signature.isSigned'
      ]);
  
    if (startDate && endDate) {
      query = query.andWhere('document.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }
  
    if (documentName) {
      query = query.andWhere('document.name LIKE :name', { name: `%${documentName}%` });
    }
  
    const [documentos, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  
    const data = documentos.map(doc => ({
      id: doc.id,
      name: doc.name,
      fileName: doc.fileName,
      typeSign: doc.signatures[0]?.signerType || 'desconocido',
      isSigned: doc.signatures[0]?.isSigned,
      isFullySigned: doc.isFullySigned 
    }));
  
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}