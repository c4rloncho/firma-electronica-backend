import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import {
  DelegationType,
  DocumentSignature,
  SignerType,
} from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { FirmaService } from 'src/firma/firma.service';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { extname, join } from 'path';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { Delegate } from 'src/funcionario/entities/delegado.entity';

@Injectable()
export class DocumentoService {
  constructor(
    @InjectRepository(Document, 'secondConnection')
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Delegate, 'secondConnection')
    private readonly delegateRepository: Repository<Delegate>,
    @InjectRepository(DocumentSignature, 'secondConnection')
    private documentSignatureRepository: Repository<DocumentSignature>,
    @InjectDataSource('secondConnection')
    private dataSource: DataSource,
    private firmaService: FirmaService,
    private entityManager: EntityManager,
  ) {}

  async createDocument(
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    return this.documentRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const { name, signers } = createDocumentDto;

        // Verificar RUTs únicos
        this.verifyUniqueRuts(signers);

        // Verificar orden correcto de firmantes y visadores
        this.verifySignerOrder(signers);

        // Generar nombre aleatorio del archivo
        const randomName = this.generateRandomFileName(file.originalname);

        // Crear y guardar el documento
        const document = await this.createAndSaveDocument(
          transactionalEntityManager,
          name,
          randomName,
        );

        // Crear y guardar las firmas
        await this.createAndSaveSignatures(
          transactionalEntityManager,
          document,
          signers,
        );

        // Guardar el archivo
        await this.saveFile(file, randomName);

        return document;
      },
    );
  }

  private verifyUniqueRuts(signers: SignerDto[]): void {
    const ruts = signers.map((signer) => signer.rut);
    const uniqueRuts = new Set(ruts);
    if (ruts.length !== uniqueRuts.size) {
      throw new BadRequestException(
        'Cada RUT debe ser único en la lista de firmantes',
      );
    }
  }

  private verifySignerOrder(signers: SignerDto[]): void {
    const firmantes = signers.filter(
      (signer) => signer.type === SignerType.FIRMADOR,
    );
    const visadores = signers.filter(
      (signer) => signer.type === SignerType.VISADOR,
    );

    if (firmantes.length === 0 || visadores.length === 0) {
      return; // No hay necesidad de verificar si no hay firmantes o visadores
    }
    //si existe un firmador con order minimo a los visadores lanza error (todos los visadores visan primero)
    const maxVisadorOrder = Math.max(...visadores.map((v) => v.order));
    const minFirmanteOrder = Math.min(...firmantes.map((f) => f.order));

    if (minFirmanteOrder <= maxVisadorOrder) {
      throw new BadRequestException(
        'Todos los visadores deben firmar antes que cualquier firmante',
      );
    }
  }

  private async createAndSaveDocument(
    transactionalEntityManager: EntityManager,
    name: string,
    fileName: string,
  ): Promise<Document> {
    const document = transactionalEntityManager.create(Document, {
      name,
      fileName,
      date: new Date(),
    });
    return transactionalEntityManager.save(document);
  }

  private async createAndSaveSignatures(
    transactionalEntityManager: EntityManager,
    document: Document,
    signers: SignerDto[],
  ): Promise<void> {
    const signatures = await Promise.all(
      signers.map(async (signer: SignerDto) => {
        const delegate = await this.delegateRepository.findOne({
          where: { ownerRut: signer.rut },
        });
        const delegateRut = delegate ? delegate.delegateRut : null;

        return transactionalEntityManager.create(DocumentSignature, {
          document,
          signerRut: signer.rut,
          signerOrder: signer.order,
          signerType: signer.type,
          delegateRut: delegateRut,
        });
      }),
    );

    await transactionalEntityManager.save(signatures);
  }

  private generateRandomFileName(originalName: string): string {
    const randomName = Array(32)
      .fill(null)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    return `${randomName}${extname(originalName)}`;
  }

  private async saveFile(
    file: Express.Multer.File,
    fileName: string,
  ): Promise<void> {
    const currentYear = new Date().getFullYear().toString();
    const uploadPath = join('./uploads', currentYear);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filePath = join(uploadPath, fileName);
    await fsp.writeFile(filePath, file.buffer);
  }

  async signDocument(input: SignDocumentDto, imageBuffer: Express.Multer.File) {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const { documentId, run } = input;
      const document = await transactionalEntityManager.findOne(Document, {
        where: { id: parseInt(documentId) },
        relations: ['signatures'],
      });

      if (!document) {
        throw new NotFoundException(
          `Documento con el id ${documentId} no encontrado`,
        );
      }

      //verifica que sea el rut original o del delegado
      const pendingSignature = document.signatures.find(
        (s) =>
          (!s.isSigned && s.signerRut === run) ||
          (!s.isSigned && s.delegateRut === run),
      );

      if (!pendingSignature) {
        throw new BadRequestException('No corresponde firmar o ya firmó');
      }
      //si es del delegado modificamos el objeto de la firma
      if (pendingSignature.delegateRut === run) {
        pendingSignature.delegationType = DelegationType.DELEGADO;
      }

      this.validateSignatureOrder(document.signatures, pendingSignature);

      try {
        const dateObject = new Date(document.date);
        const documentYear = dateObject.getFullYear().toString();

        const { content, checksum } = await this.prepareFile(
          document.fileName,
          documentYear,
        );

        const firmaResult = await this.firmaService.signdocument(
          {
            ...input,
            documentContent: content,
            documentChecksum: checksum,
          },
          imageBuffer,
        );

        if (firmaResult.success) {
          await this.saveSignedFile(
            firmaResult.signatureInfo.signedFiles[0],
            document,
          );
          pendingSignature.isSigned = true;
          pendingSignature.signedAt = new Date();
          await transactionalEntityManager.save(pendingSignature);

          const allSigned = document.signatures.every((s) => s.isSigned);
          if (allSigned) {
            document.isFullySigned = true;
            await transactionalEntityManager.save(document);
          }

          return {
            message: 'Documento firmado exitosamente',
            signature: pendingSignature,
            firmaInfo: firmaResult.signatureInfo,
          };
        } else {
          throw new BadRequestException(
            'La firma digital no se pudo completar',
          );
        }
      } catch (error) {
        throw new BadRequestException(
          `Error al firmar el documento: ${error.message}`,
        );
      }
    });
  }
  private async saveSignedFile(
    signedFile: { content: Buffer; checksum: string },
    document: Document,
  ): Promise<void> {
    const documentYear = new Date(document.date);
    const year = documentYear.getFullYear().toString();
    const signedFileName = document.fileName;
    const signedFilePath = join('./uploads', year);
    const filePath = join(signedFilePath, signedFileName);
    await fsp.writeFile(filePath, signedFile.content);
  }

  private validateSignatureOrder(
    signatures: DocumentSignature[],
    currentSignature: DocumentSignature,
  ) {
    const previousSignatures = signatures.filter(
      (s) =>
        s.signerOrder < currentSignature.signerOrder &&
        s.signerType === currentSignature.signerType,
    );

    if (previousSignatures.some((s) => !s.isSigned)) {
      throw new BadRequestException(
        'Hay firmas pendientes de su mismo tipo con orden anterior',
      );
    }

    if (currentSignature.signerType === SignerType.FIRMADOR) {
      const allVisadores = signatures.filter(
        (s) => s.signerType === SignerType.VISADOR,
      );
      if (allVisadores.some((s) => !s.isSigned)) {
        throw new BadRequestException(
          'Todos los visadores deben firmar antes que los firmadores',
        );
      }
    }
  }

  private async prepareFile(
    fileName: string,
    year: string,
  ): Promise<{ content: string; checksum: string }> {
    const filePath = `./uploads/${year}/${fileName}`;
    const fileBuffer = await fsp.readFile(filePath);
    const content = fileBuffer.toString('base64');
    const checksum = this.calculateChecksum(fileBuffer);
    return { content, checksum };
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  async getById(id: number) {
    if (!id || isNaN(id)) {
      throw new BadRequestException(
        'ID inválido. Debe ser un número entero positivo.',
      );
    }

    try {
      const document = await this.documentRepository.findOne({ where: { id } });
      if (!document) {
        throw new NotFoundException(`Documento no encontrado con id ${id}`);
      }
      const dateObject = new Date(document.date);
      const documentYear = dateObject.getFullYear().toString();
      const filePath = `./uploads/${documentYear}/${document.fileName}`;
      return {
        ...document,
        filePath,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al buscar el documento con id ${id}: ${error.message}`,
      );
    }
  }

  async getPendingSignatures(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string,
  ): Promise<{
    data: { id: number; name: string; fileName: string; typeSign: string }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let query = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.signatures', 'signature')
      .select([
        'document.id',
        'document.name',
        'document.fileName',
        'signature.signerType',
      ])
      .where('signature.signerRut = :rut', { rut })
      .andWhere('signature.isSigned = :isSigned', { isSigned: false })
      .andWhere('document.isFullySigned = :isFullySigned', {
        isFullySigned: false,
      });

    if (startDate && endDate) {
      query = query.andWhere(
        'document.createdAt BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    if (documentName) {
      query = query.andWhere('document.name LIKE :name', {
        name: `%${documentName}%`,
      });
    }

    const [documentos, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = documentos.map((doc) => ({
      id: doc.id,
      name: doc.name,
      fileName: doc.fileName,
      typeSign: doc.signatures[0]?.signerType || 'desconocido',
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllDocumentsByRut(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string,
  ): Promise<{
    data: {
      id: number;
      name: string;
      fileName: string;
      typeSign: string;
      isSigned: boolean;
      isFullySigned: boolean;
      delegationType: string;
      delegateRut: string;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    let query = this.documentRepository
      .createQueryBuilder('document')
      .innerJoin(
        'document.signatures',
        'signature',
        'signature.signerRut = :rut',
        { rut },
      )
      .select([
        'document.id',
        'document.name',
        'document.fileName',
        'document.isFullySigned',
        'signature.signerType',
        'signature.isSigned',
        'signature.delegationType',
        'signature.delegateRut',
      ]);

    if (startDate && endDate) {
      query = query.andWhere(
        'document.createdAt BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    if (documentName) {
      query = query.andWhere('document.name LIKE :name', {
        name: `%${documentName}%`,
      });
    }

    const [documentos, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = documentos.map((doc) => ({
      id: doc.id,
      name: doc.name,
      fileName: doc.fileName,
      typeSign: doc.signatures[0]?.signerType || 'desconocido',
      isSigned: doc.signatures[0]?.isSigned,
      isFullySigned: doc.isFullySigned,
      delegationType: doc.signatures[0]?.delegationType,
      delegateRut: doc.signatures[0]?.delegateRut,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getInfoDocumentId(id: number) {
    return await this.documentRepository.find({
      where: { id: id },
      relations: ['signatures'],
    });
  }
}
