import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature, SignerType } from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { FirmaService } from 'src/firma/firma.service';

@Injectable()
export class DocumentoService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentSignature)
    private readonly documentSignatureRepository: Repository<DocumentSignature>,
    private firmaService: FirmaService,
  ) {}

  async createDocument(
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    return this.documentRepository.manager.transaction(async transactionalEntityManager => {
      const { name, signers } = createDocumentDto;
  
      const document = transactionalEntityManager.create(Document, {
        name,
        fileName: file.filename,
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

    try {
      // Llamada al servicio de firma
      const firmaResult = await this.firmaService.signdocument(input, imageBuffer,document);
      if (firmaResult.success) {
        pendingSignature.isSigned = true;
        pendingSignature.signedAt = new Date();
        await this.documentSignatureRepository.save(pendingSignature);

        // Verificar si el documento está completamente firmado
        await this.checkAndUpdateDocumentStatus(document);

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
  private validateSignatureOrder(signatures: DocumentSignature[], currentSignature: DocumentSignature) {
    const previousSignatures = signatures.filter(
      (s) => s.signerOrder < currentSignature.signerOrder && s.signerType === currentSignature.signerType
    );
    
    if (previousSignatures.some((s) => !s.isSigned)) {
      throw new BadRequestException('Hay firmas pendientes de su mismo tipo con orden anterior');
    }

    if (currentSignature.signerType === SignerType.FIRMADOR) {
      const allVisadores = signatures.filter((s) => s.signerType === SignerType.VISADOR);
      if (allVisadores.some((s) => !s.isSigned)) {
        throw new BadRequestException('Todos los visadores deben firmar antes que los firmadores');
      }
    }
  }

  private async checkAndUpdateDocumentStatus(document: Document) {
    const allSigned = document.signatures.every(s => s.isSigned);
    if (allSigned) {
      document.isFullySigned = true;
      await this.documentRepository.save(document);
    }
  }

    //retorna informacion de los documentos y la id por si el usuario necesita descargarlos
    async buscarFirmasPendientes(rut: string): Promise<{ id: number; name: string; fileName: string }[]> {
      const documentos = await this.documentRepository.find({
        select: ['id', 'name', 'fileName'],
        where: {
          signatures: {
            signerRut: rut,
            isSigned: false
          },
          isFullySigned: false
        },
        relations: ['signatures']
      }); 
      //solo muestra los que al usuario le falta firmar
      return documentos.map(doc => ({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName
      }));
    }
}
