import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';

@Injectable()
export class DocumentoService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentSignature)
    private readonly documentSignatureRepository: Repository<DocumentSignature>,
  ) {}

  async createDocument(
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    const { name, signers } = createDocumentDto;

    const document = this.documentRepository.create({
      name,
      fileName: file.filename,
    });
    await this.documentRepository.save(document);

    const signatures = signers.map((signer: SignerDto) =>
      this.documentSignatureRepository.create({
        document,
        signerRut: signer.rut,
        signerOrder: signer.order,
      }),
    );
    await this.documentSignatureRepository.save(signatures);
    return document;
  }

  async signDocument(input: SignDocumentDto) {
    const { documentId, rut } = input;
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['signatures'],
    });

    if (!document) {
      throw new NotFoundException(
        `documento con el id ${documentId} no encontrado`,
      );
    }

    const pendingSignature = document.signatures.find(
      (s) => !s.isSigned && s.signerRut == rut,
    );

    if (!pendingSignature) {
      throw new BadRequestException('no corresponde firmar o ya firmó');
    }

    if (pendingSignature.signerOrder === 1) {
      pendingSignature.isSigned = true;
      pendingSignature.signedAt = new Date();
      await this.documentSignatureRepository.save(pendingSignature);
      return;
    }

    const beforeSignature = document.signatures.find(
      (s) => s.signerOrder === pendingSignature.signerOrder - 1,
    );

    if (!beforeSignature || !beforeSignature.isSigned) {
      throw new BadRequestException('la persona anterior no ha firmado');
    }

    pendingSignature.isSigned = true;
    pendingSignature.signedAt = new Date();
    //llamado a la api para que firme el documento antes de guardar
    
    await this.documentSignatureRepository.save(pendingSignature);
    

  }
  async getById(id: number) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Documento no encontrado con id ${id}`);
    }
    return {
      ...document,
      filePath: `./uploads/${document.fileName}` // Asumiendo que tienes un campo fileName en tu entidad
    };
  }
}
