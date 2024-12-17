import { Readable } from 'stream';
import { Response } from 'express';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  Brackets,
  DataSource,
  EntityManager,
  ILike,
  In,
  IsNull,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Repository,
  ReturningStatementNotSupportedError,
} from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';
import { FirmaService } from 'src/firma/firma.service';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { extname, join } from 'path';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { Delegate } from 'src/delegate/entities/delegado.entity';
import { User } from 'src/interfaces/firma.interfaces';
import { RemoteStorageService } from 'src/documento/sftp-storage-service';
import { SignatureStatus } from './dto/signature-status.enum';
import { SignerType } from 'src/enums/signer-type.enum';
import { Attachment } from 'src/attachment/entities/attachment.entity';
import { Rol } from 'src/enums/rol.enum';
import { DocumentView } from './entities/document-visible-users.entity';
import { TypeDocument } from 'src/type-document/entities/type-document.entity';
import { existsSync } from 'fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Servicio para manejar operaciones relacionadas con documentos y firmas.
 */
@Injectable()
export class DocumentoService {
  private readonly logger = new Logger(DocumentoService.name);
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Delegate)
    private readonly delegateRepository: Repository<Delegate>,
    @InjectDataSource()
    private readonly signatureRepository: Repository<DocumentSignature>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
    @InjectRepository(DocumentView)
    private readonly documentViewRepository: Repository<DocumentView>,
    @InjectRepository(TypeDocument)
    private readonly typeDocumentRepository: Repository<TypeDocument>,
    @InjectDataSource()
    private dataSource: DataSource,
    private firmaService: FirmaService,
    private remoteStorage: RemoteStorageService,
  ) {}

  /**
   * Crea un nuevo documento y guarda las firmas asociadas.
   * @param createDocumentDto DTO con la información del documento a crear.
   * @param file Archivo del documento.
   * @returns Promesa que resuelve al documento creado.
   * @throws BadRequestException si los RUTs no son únicos o el orden de firmantes es incorrecto.
   */
  async createDocument(
    creatorRut: string,
    createDocumentDto: CreateDocumentDto,
    file: Express.Multer.File,
  ): Promise<Document> {
    return this.documentRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const { name, signers, rutsToNotify, heightSigns, typeDocument } =
          createDocumentDto;

        // Verificar RUTs únicos
        this.verifyUniqueRuts(signers);

        // Verificar orden correcto de firmantes y visadores
        this.verifySignerOrder(signers);

        // Generar nombre aleatorio del archivo
        const randomName = this.generateRandomFileName(file.originalname);

        //buscar typeDocument
        const typeDoc = await this.typeDocumentRepository.findOne({
          where: { id: parseInt(typeDocument) },
        });
        if (!typeDoc) {
          throw new NotFoundException('Tipo de documento no encontrado');
        }
        // Crear y guardar el documento
        const document = await this.createAndSaveDocument(
          transactionalEntityManager,
          name,
          randomName,
          creatorRut,
          rutsToNotify,
          heightSigns,
          typeDoc,
          signers,
        );

        // Crear y guardar las firmas
        await this.createAndSaveSignatures(
          transactionalEntityManager,
          document,
          signers,
        );

    
        await this.modifyDocument(file, heightSigns,document.totalSigners);
        // Guardar el archivo
        await this.saveFile(file, randomName);

        return document;
      },
    );
  }
  async modifyDocument(
    file: Express.Multer.File,
    heightSigns: number,
    totalSigners: number,
): Promise<void> {
    try {
        const existingPdfBytes = file.buffer;
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();

        // Si la altura es alta (≥25), máximo 2 firmas por página
        if (heightSigns >= 25) {
            if (totalSigners > 2) {
                pdfDoc.addPage([width, height]);
            }
        } else {
            // Para alturas bajas, calcular según espacio disponible
            const firmasPorPagina = heightSigns <= 15 ? 8 : 4;  
            
            if (totalSigners > firmasPorPagina) {
                pdfDoc.addPage([width, height]);
            }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        file.buffer = Buffer.from(modifiedPdfBytes);
        file.size = modifiedPdfBytes.length;
    } catch (error) {
        throw new Error('Error al modificar el documento PDF');
    }
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
    //si existe un firmador con order mínimo a los visadores lanza error (todos los visadores visan primero)
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
    creatorRut: string,
    rutsToNotify: string[],
    heightSigns: number,
    typeDocument: TypeDocument,
    signers:SignerDto[],
  ): Promise<Document> {
    let totalSigners = 0;
    let totalValidator = 0;
    
    for (const signer of signers) {
        if (signer.type === 'firmador') {
            totalSigners++;
        }
        if (signer.type === 'visador') {
            totalValidator++;
        }
    }
    // Crear la instancia del documento
    const document = transactionalEntityManager.create(Document, {
      name,
      fileName,
      creatorRut,
      date: new Date(),
      heightSigns,
      typeDocument,
      totalSigners,
      totalValidator,
    });

    // Guardar el documento
    const savedDocument = await transactionalEntityManager.save(document);

    // Buscar funcionarios a notificar
    const funcionarios = await transactionalEntityManager.find(Funcionario, {
      where: { rut: In(rutsToNotify) },
    });

    // Crear y guardar las vistas del documento
    if (funcionarios && funcionarios.length > 0) {
      const documentViews = funcionarios.map((funcionario) =>
        transactionalEntityManager.create(DocumentView, {
          document: savedDocument,
          funcionario: funcionario,
          isVisible: false,
        }),
      );

      // Guardar todas las vistas
      await transactionalEntityManager.save(documentViews);
    }

    return savedDocument;
  }

  private async createAndSaveSignatures(
    transactionalEntityManager: EntityManager,
    document: Document,
    signers: SignerDto[],
  ): Promise<void> {
    const signatures = await Promise.all(
      signers.map(async (signer: SignerDto) => {
        //cada persona solo puede tener un solo delegado(ownerRut no se puede repetir)
        const delegate = await this.delegateRepository.findOne({
          where: { ownerRut: signer.rut },
        });
        return transactionalEntityManager.create(DocumentSignature, {
          document,
          signerRut: null, //se pondrá el rut de la persona que firme el documento
          signerOrder: signer.order,
          signerType: signer.type,
          ownerRut: signer.rut,
          signerName: signer.name,
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
  ): Promise<string> {
    const currentYear = new Date().getFullYear().toString();
    const remotePath = `/uploads/${currentYear}/${fileName}`;

    try {
      await this.remoteStorage.uploadFile(file.buffer, remotePath);
      return remotePath;
    } catch (error) {
      console.error(`Error al subir el archivo: ${error.message}`);
      throw error;
    }
  }
  /**
   * Firma un documento.
   * @param input DTO con la información de la firma.
   * @param imageBuffer Buffer de la imagen de la firma.
   * @returns Promesa que resuelve a la información de la firma realizada.
   * @throws BadRequestException si el documento ya ha sido firmado o no corresponde firmar.
   * @throws NotFoundException si el documento no se encuentra.
   */
  async signDocument(run: string, input: SignDocumentDto) {
    try {
      return this.dataSource.transaction(async (transactionalEntityManager) => {
        const { documentId } = input;
        const document = await transactionalEntityManager.findOne(Document, {
          where: { id: documentId },
          relations: ['signatures', 'documentViews'],
        });
        if (!document) {
          throw new NotFoundException(
            `Documento con el id ${documentId} no encontrado o fue eliminado`,
          );
        }
        const funcionario = await this.funcionarioRepository.findOne({
          where: { rut: run },
        });
        if (!funcionario) {
          throw new NotFoundException('funcionario no encontrado');
        }
        // Verificar si la persona ya ha firmado el documento
        const alreadySigned = document.signatures.some(
          (s) => s.signerRut === run && s.isSigned,
        );
        if (alreadySigned) {
          throw new BadRequestException('Ya ha firmado este documento');
        }

        // Buscar la firma pendiente como firmante original
        let pendingSignature = document.signatures.find(
          (s) => !s.isSigned && s.ownerRut === run,
        );
        // Buscar delegaciones activas
        const activeDelegations = await transactionalEntityManager.find(
          Delegate,
          {
            where: { delegateRut: run, isActive: true },
          },
        );
        // Verificar si es un firmante original y también un delegado activo
        if (pendingSignature && activeDelegations.length > 0) {
          const isDelegateForAnotherSigner = activeDelegations.some(
            (delegation) =>
              document.signatures.some(
                (s) => s.ownerRut === delegation.ownerRut && s.ownerRut !== run,
              ),
          );

          if (isDelegateForAnotherSigner) {
            throw new BadRequestException(
              'Usted es firmante original y delegado de otro firmante en este documento. Por favor, contacte al administrador.',
            );
          }
        }

        // Si no es firmante original, buscar como delegado
        if (!pendingSignature) {
          pendingSignature = document.signatures.find(
            (s) =>
              !s.isSigned &&
              activeDelegations.some((d) => d.ownerRut === s.ownerRut),
          );

          if (!pendingSignature) {
            throw new BadRequestException(
              'No corresponde firmar o el delegado no está activo para ningún propietario que deba firmar',
            );
          }
        }

        // Actualizar el signerRut con quien realmente está firmando
        pendingSignature.signerRut = run;

        try {
          this.validateSignatureOrder(document.signatures, pendingSignature);
        } catch (error) {
          throw new BadRequestException(error.message);
        }

        try {
          const dateObject = new Date(document.date);
          const documentYear = dateObject.getFullYear().toString();
          const { fileBuffer, checksum } = await this.prepareFile(
            document.fileName,
            documentYear,
          );
          const cleanRut = this.cleanRut(run);
          const imageBuffer = this.getImageByType(pendingSignature.signerType);
          const firmaResult = await this.firmaService.signdocument(
            {
              ...input,
              documentBuffer: fileBuffer, // Cambio aquí: enviamos el buffer en lugar del base64
              documentChecksum: checksum,
              funcionario,
              heightImage: document.heightSigns,
            },
            pendingSignature.signerOrder,
            cleanRut,
            imageBuffer,
            pendingSignature.signerType,
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
              await this.notifyFuncionario(document);
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
    } catch (error) {
      console.error('Error en signDocument:', error);
      throw error;
    }
  }

  private async notifyFuncionario(document: Document) {
    document.documentViews.forEach((view) => {
      view.isVisible = true;
    });
    await this.documentViewRepository.save(document.documentViews);
  }
  private getImageByType(signerType: string): Buffer {
    const filePath = join(__dirname, '../images/firma1.png');
    
    if (signerType.toUpperCase() === SignerType.FIRMADOR) {
        if (!existsSync(filePath)) {
            throw new Error(`Archivo de firma no encontrado en: ${filePath}`);
        }
        
        // const buffer = fs.readFileSync(filePath);
        // return buffer;
    }
    const buffer = fs.readFileSync(filePath);
    return buffer;
    //return null;
}
  private cleanRut(rut: string) {
    // Limpia el RUT
    let cleanRut = rut.replace(/[.-]/g, '');
    cleanRut = cleanRut.slice(0, -1);

    // Crea y retorna un nuevo objeto con el DTO original y el RUN limpio
    return cleanRut;
  }

  async prepareFile(
    fileName: string,
    year: string,
  ): Promise<{ fileBuffer: Buffer; checksum: string }> {
    const remotePath = `/uploads/${year}/${fileName}`;
    try {
      const fileStream = await this.remoteStorage.getFileStream(remotePath);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk) => chunks.push(chunk));
        fileStream.on('end', () => {
          const fileBuffer = Buffer.concat(chunks);
          const checksum = this.calculateChecksum(fileBuffer);
          resolve({ fileBuffer, checksum });
        });
        fileStream.on('error', (error) => {
          reject(
            new Error(`Error al leer el archivo remoto: ${error.message}`),
          );
        });
      });
    } catch (error) {
      throw new Error(`Error al preparar el archivo remoto: ${error.message}`);
    }
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  private async saveSignedFile(
    signedFile: { content: Buffer; checksum: string },
    document: Document,
  ): Promise<string> {
    const documentYear = new Date(document.date).getFullYear().toString();
    const signedFileName = document.fileName;
    const remotePath = `/uploads/${documentYear}/${signedFileName}`;

    try {
      await this.remoteStorage.uploadFile(signedFile.content, remotePath);
      console.log(`Archivo firmado subido exitosamente a: ${remotePath}`);
      return remotePath;
    } catch (error) {
      console.error(`Error al subir el archivo firmado: ${error.message}`);
      throw error;
    }
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
  /**
   * Obtiene un documento por su ID.
   * @param id ID del documento.
   * @returns Promesa que resuelve a la información del documento.
   * @throws BadRequestException si el ID es inválido.
   * @throws NotFoundException si el documento no se encuentra.
   */
  private async validateAuthorization(
    document: Document,
    user: User,
  ): Promise<void> {
    if (user.rol !== Rol.ADMIN) {
      const isAuthorized =
        document.creatorRut === user.rut ||
        document.signatures.some(
          (s) => s.ownerRut === user.rut || s.signerRut === user.rut,
        );

      if (!isAuthorized) {
        throw new UnauthorizedException(
          'No tienes permiso para acceder a este documento',
        );
      }
    }
  }

  private setResponseHeaders(
    res: Response,
    fileName: string,
    action: 'view' | 'download',
  ): void {
    res.setHeader('Content-Type', 'application/pdf');

    const encodedFileName = encodeURIComponent(fileName);

    const disposition = action === 'download' ? 'attachment' : 'inline';
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodedFileName}"`,
    );

    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Agregar timestamp para forzar refresco
    res.setHeader('Last-Modified', new Date().toUTCString());
  }
  async getById(
    id: number,
    user: User,
    res: Response,
    action: 'view' | 'download' = 'view',
  ): Promise<void> {
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        relations: ['signatures'],
      });

      if (!document) {
        throw new NotFoundException(`Documento no encontrado con id ${id}`);
      }

      // Validar autorización del usuario
      await this.validateAuthorization(document, user);

      // Verificar que sea un archivo PDF
      if (!document.fileName.toLowerCase().endsWith('.pdf')) {
        throw new BadRequestException('El archivo solicitado no es un PDF');
      }

      const documentYear = new Date(document.date).getFullYear().toString();
      const remoteFilePath = `/uploads/${documentYear}/${document.fileName}`;

      try {
        const fileStream =
          await this.remoteStorage.getFileStream(remoteFilePath);

        this.setResponseHeaders(res, document.fileName, action);

        fileStream.on('error', (error) => {
          throw new InternalServerErrorException(
            `Error durante la transmisión del PDF: ${error.message}`,
          );
        });

        fileStream.pipe(res);
      } catch (streamError) {
        throw new InternalServerErrorException(
          `Error al acceder al archivo PDF en el almacenamiento: ${streamError.message}`,
        );
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al procesar la solicitud del documento con id ${id}: ${error.message}`,
      );
    }
  }

  async getMyCreatedDocument(
    rut: string,
    page: number,
    limit: number,
    name?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    data: {
      id: number;
      creatorRut: string;
      date: Date;
      name: string;
      isFullySigned: boolean;
      attachments: {
        id: number;
        name: string;
      }[];
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = await this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.attachments', 'attachment')
      .where('document.creatorRut = :rut', { rut });

    if (startDate && endDate) {
      query.andWhere('document.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      query.andWhere('document.date >= :startDate', { startDate });
    } else if (endDate) {
      query.andWhere('document.date <= :endDate', { endDate });
    }

    if (name) {
      query.andWhere('document.name ILIKE :name', { name: `%${name}%` });
    }

    query.orderBy('document.date', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [documents, total] = await query.getManyAndCount();

    // Ahora la respuesta mantiene la estructura anidada natural
    return {
      data: documents.map((doc) => ({
        id: doc.id,
        creatorRut: doc.creatorRut,
        date: doc.date,
        name: doc.name,
        isFullySigned: doc.isFullySigned,
        attachments: doc.attachments.map((att) => ({
          id: att.id,
          name: att.name,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene las firmas pendientes para un RUT dado.
   * @param rut RUT del firmante.
   * @param page Número de página para la paginación.
   * @param limit Límite de resultados por página.
   * @param startDate Fecha de inicio para filtrar.
   * @param endDate Fecha de fin para filtrar.
   * @param documentName Nombre del documento para filtrar.
   * @returns Promesa que resuelve a un objeto con los datos paginados de las firmas pendientes.
   */

  async getPendingSignatures(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string,
  ): Promise<{
    data: {
      documentId: number;
      documentName: string;
      fileName: string;
      date: Date;
      signatures: {
        signatureId: number;
        signatureType: 'Titular' | 'Subrogante';
        ownerRut: string;
        signerType: SignerType;
        signerOrder: number;
        isSigned: boolean;
        signerRut?: string;
        signerName?: string;
        signedAt?: Date;
        SignatureStatus: SignatureStatus;
      }[];
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // 1. Obtener los RUTs delegados
    const delegates = await this.delegateRepository.find({
      where: { delegateRut: rut, isActive: true },
    });

    const ownerRuts = delegates.map((d) => d.ownerRut);
    ownerRuts.push(rut);

    const query = this.documentRepository
      .createQueryBuilder('document')
      .innerJoin(
        'document.signatures',
        'pendingSignatures',
        'pendingSignatures.ownerRut IN (:...ownerRuts) AND pendingSignatures.isSigned = :isSigned',
        { ownerRuts, isSigned: false },
      )
      .leftJoinAndSelect('document.signatures', 'allSignatures')
      .orderBy('document.date', 'DESC')
      .addOrderBy('allSignatures.signerOrder', 'ASC');

    if (startDate && endDate) {
      query.andWhere('document.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      query.andWhere('document.date >= :startDate', { startDate });
    } else if (endDate) {
      query.andWhere('document.date <= :endDate', { endDate });
    }

    if (documentName) {
      query.andWhere('document.name ILIKE :nombre', {
        nombre: `%${documentName}%`,
      });
    }

    // 4. Obtener resultados paginados
    const [documents, total] = await query
      .distinct(true)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 5. Formatear la respuesta
    const dataFormatted = documents.map((doc) => {
      // Filtrar solo las firmas que el usuario puede realizar
      const userSignatures = doc.signatures.filter((sig) =>
        ownerRuts.includes(sig.ownerRut),
      );

      return {
        documentId: doc.id,
        documentName: doc.name,
        fileName: doc.fileName,
        date: doc.date,
        signatures: userSignatures.map((sig) => ({
          signatureId: sig.id,
          signatureType:
            sig.ownerRut === rut
              ? ('Titular' as const)
              : ('Subrogante' as const),
          ownerRut: sig.ownerRut,
          signerType: sig.signerType,
          signerOrder: sig.signerOrder,
          isSigned: sig.isSigned,
          signerRut: sig.signerRut,
          signerName: sig.signerName,
          signedAt: sig.signedAt,
          SignatureStatus: this.evaluateSignatureStatus(
            rut,
            sig,
            delegates,
            doc.signatures, // Pasamos todas las firmas para la evaluación
          ),
        })),
      };
    });

    return {
      data: dataFormatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private evaluateSignatureStatus(
    rut: string,
    currentSignature: DocumentSignature,
    activeDelegations: Delegate[],
    allSignatures: DocumentSignature[], // Recibimos todas las firmas del documento
  ): SignatureStatus {
    // 1. Verificar si la persona ya ha firmado el documento
    const alreadySigned = allSignatures.some(
      (s) => s.signerRut === rut && s.isSigned,
    );

    if (alreadySigned) {
      return SignatureStatus.AlreadySigned;
    }

    // 2. Verificar si es un delegado activo para alguna firma pendiente
    const canSignAsDelegate = activeDelegations.some((delegation) =>
      allSignatures.some(
        (s) => s.ownerRut === delegation.ownerRut && !s.isSigned,
      ),
    );

    // 3. Verificar si es un firmante original y también un delegado
    const isDelegateAndOriginalSigner =
      currentSignature.ownerRut === rut &&
      canSignAsDelegate &&
      activeDelegations.some((delegation) =>
        allSignatures.some(
          (s) =>
            s.ownerRut === delegation.ownerRut &&
            s.ownerRut !== rut &&
            !s.isSigned,
        ),
      );

    if (isDelegateAndOriginalSigner) {
      return SignatureStatus.DelegateConflict;
    }

    // 4. Verificar si es el turno de firmar según el orden de todas las firmas
    const orderedSignatures = allSignatures.sort(
      (a, b) => a.signerOrder - b.signerOrder,
    );

    const currentSignatureIndex = orderedSignatures.findIndex(
      (s) => s.id === currentSignature.id,
    );

    // Verificar si todas las firmas anteriores están firmadas
    const allPreviousAreSigned = orderedSignatures
      .slice(0, currentSignatureIndex)
      .every((s) => s.isSigned);

    if (allPreviousAreSigned && !currentSignature.isSigned) {
      return SignatureStatus.CanSign;
    }

    return SignatureStatus.NotYourTurn;
  }

  /**
   * Obtiene todos los documentos asociados a un RUT.
   * @param rut RUT del firmante o delegado.
   * @param page Número de página para la paginación.
   * @param limit Límite de resultados por página.
   * @param startDate Fecha de inicio para filtrar.
   * @param endDate Fecha de fin para filtrar.
   * @param documentName Nombre del documento para filtrar.
   * @param status Estado de los documentos a obtener ('pending', 'signed', 'all').
   * @returns Promesa que resuelve a un objeto con los datos paginados de los documentos.
   */
  async getAllDocumentsByRut(
    rut: string,
    page: number = 1,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
    documentName?: string,
  ): Promise<{
    data: {
      signatureId: number;
      id: number;
      name: string;
      fileName: string;
      isSigned: boolean;
      signatureType: 'Titular' | 'Subrogante';
      ownerRut: string;
      signedAt: Date | null;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    rut;
    const delegates = await this.delegateRepository.find({
      where: { delegateRut: rut, isActive: true },
    });

    const ownerRuts = [...new Set([...delegates.map((d) => d.ownerRut), rut])];

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.signatures', 'signature')
      .where('signature.ownerRut IN (:...ownerRuts)', { ownerRuts });

    if (startDate && endDate) {
      queryBuilder.andWhere('document.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      queryBuilder.andWhere('document.date >= :startDate', { startDate });
    } else if (endDate) {
      queryBuilder.andWhere('document.date <= :endDate', { endDate });
    }

    if (documentName) {
      queryBuilder.andWhere('document.name ILIKE :nombre', {
        nombre: `%${documentName}%`,
      });
    }

    const [documents, total] = await queryBuilder
      .orderBy('document.date', 'DESC')
      .addOrderBy('signature.isSigned', 'ASC') // Primero las firmas pendientes
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const formattedData = documents.flatMap((doc) =>
      doc.signatures
        .filter((sig) => ownerRuts.includes(sig.ownerRut))
        .map((sig) => ({
          signatureId: sig.id,
          id: doc.id,
          name: doc.name,
          fileName: doc.fileName,
          isSigned: sig.isSigned,
          signatureType:
            sig.ownerRut === rut
              ? ('Titular' as const)
              : ('Subrogante' as const),
          ownerRut: sig.ownerRut,
          signedAt: sig.signedAt,
        })),
    );

    return {
      data: formattedData,
      total: formattedData.length,
      page,
      limit,
      totalPages: Math.ceil(formattedData.length / limit),
    };
  }
  /**
   * Obtiene la información detallada de un documento por su ID.
   * @param id ID del documento.
   * @returns Promesa que resuelve a la información detallada del documento, incluyendo sus firmas.
   */

  async getInfoDocumentId(id: number) {
    try {
      // Validación del ID
      if (!id || id < 0) {
        throw new Error('ID de documento inválido');
      }

      const document = await this.documentRepository.findOne({
        where: { id },
        relations: ['signatures', 'typeDocument'],
        withDeleted: true,
      });
      // Validar si el documento existe
      if (!document) {
        throw new Error(`Documento con ID ${id} no encontrado`);
      }

      // Validar que signatures no sea null/undefined
      if (!document.signatures) {
        throw new Error(
          `Documento ${id} no tiene la relación de firmas cargada correctamente`,
        );
      }

      return {
        id: document.id,
        name: document.name,
        creatorRut: document.creatorRut,
        date: document.date,
        isFullySigned: document.isFullySigned,
        typeDocument:
          document.typeDocument?.name || 'Tipo de documento no disponible',
        signatures: document.signatures.map((sig) => {
          return {
            id: sig.id,
            name: sig.signerName,
            signedAt: sig.signedAt,
            signerRut: sig.signerRut,
            isSigned: sig.isSigned,
            ownerRut: sig.ownerRut,
            signerType: sig.signerType,
          };
        }),
      };
    } catch (error) {
      // Log del error para debugging
      console.error(`Error al obtener información del documento ${id}:`, error);

      // Relanzar el error con un mensaje más amigable
      throw new Error(`Error al procesar el documento: ${error.message}`);
    }
  }

  async findFullySigned(
    page: number = 1,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
    name?: string,
  ): Promise<{
    data: Document[];
    total: number;
    page: number;
    lastPage: number;
  }> {
    const skip = (page - 1) * limit;

    let whereClause: any = { isFullySigned: true };

    if (startDate && endDate) {
      whereClause.date = Between(new Date(startDate), new Date(endDate));
    }

    if (name) {
      whereClause.name = Like(`%${name}%`);
    }

    const [documents, total] = await this.documentRepository.findAndCount({
      where: whereClause,
      skip,
      take: limit,
      order: { date: 'DESC' },
    });

    if (documents.length === 0) {
      throw new NotFoundException(
        'No se encontraron documentos completamente firmados para los criterios especificados',
      );
    }

    const lastPage = Math.ceil(total / limit);

    return {
      data: documents,
      total,
      page,
      lastPage,
    };
  }

  async deleteDocument(rut: string, idDocument: number) {
    return this.dataSource.transaction(async (transactionManager) => {
      // Buscar el documento con sus firmas y anexos
      const document = await transactionManager.findOne(Document, {
        where: { creatorRut: rut, id: idDocument },
        relations: ['signatures', 'attachments'],
      });

      // Verificar si el documento existe
      if (!document) {
        throw new NotFoundException('Documento no encontrado');
      }

      const isSigned = document.signatures.some((s) => s.isSigned);

      if (isSigned) {
        throw new BadRequestException(
          'No se puede eliminar un documento que ya ha sido firmado',
        );
      }

      // Soft delete de anexos
      if (document.attachments.length > 0) {
        await Promise.all(
          document.attachments.map((attachment) =>
            transactionManager.softDelete(Attachment, attachment.id),
          ),
        );
      }

      await transactionManager.softDelete(Document, document.id);

      return { message: 'Documento eliminado exitosamente' };
    });
  }

  async getReceivedDocuments(
    rut: string,
    page: number,
    limit: number,
    name?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const query = this.documentViewRepository
      .createQueryBuilder('docView')
      .leftJoinAndSelect('docView.document', 'document')
      .leftJoinAndSelect('docView.funcionario', 'funcionario')
      .where('funcionario.rut = :rut', { rut })
      .andWhere('docView.isVisible = :isVisible', { isVisible: true });

    if (name) {
      query.andWhere('document.name ILIKE :name', {
        name: `%${name}%`,
      });
    }

    if (startDate) {
      query.andWhere('document.date >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('document.date <= :endDate', { endDate });
    }

    const [documentsView, total] = await query
      .orderBy('document.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const formattedData = documentsView.map((view) => {
      return {
        documentViewId: view.id,
        documentId: view.document.id,
        documentName: view.document.name,
        documentDate: view.document.date,
        documentCreatorRut: view.document.creatorRut,
      };
    });
    return {
      data: formattedData,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async deleteReceivedDocuments(rut: string, id: number) {
    const documentView = await this.documentViewRepository.findOne({
      where: {
        id,
        funcionario: { rut },
      },
    });

    if (!documentView) {
      throw new NotFoundException(
        'no tienes permiso para eliminar esta notificación',
      );
    }

    await this.documentViewRepository.remove(documentView);
    return { message: 'elemento eliminado correctamente' };
  }
}
