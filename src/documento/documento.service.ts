import { Readable } from 'stream';
import { Response } from 'express';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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
} from 'typeorm';
import { Document } from './entities/document.entity';
import {
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
import { Delegate } from 'src/delegate/entities/delegado.entity';
import { User } from 'src/interfaces/firma.interfaces';
import { Cargo } from 'src/auth/dto/cargo.enum';
import { RemoteStorageService } from 'src/documento/sftp-storage-service';
import { SignatureStatus } from './dto/signature-status.enum';

/**
 * Servicio para manejar operaciones relacionadas con documentos y firmas.
 */
@Injectable()
export class DocumentoService {
  constructor(
    @InjectRepository(Document, 'secondConnection')
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Delegate, 'secondConnection')
    private readonly delegateRepository: Repository<Delegate>,
    @InjectDataSource('secondConnection')
    private readonly signatureRepository:Repository<DocumentSignature>,
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
          creatorRut,
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
    creatorRut: string,
  ): Promise<Document> {
    const document = transactionalEntityManager.create(Document, {
      name,
      fileName,
      creatorRut,
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
        //cada persona solo puede tener un solo delegado(ownerRut no se puede repetir)
        const delegate = await this.delegateRepository.findOne({
          where: { ownerRut: signer.rut },
        });
        return transactionalEntityManager.create(DocumentSignature, {
          document,
          signerRut: null, //se pondra el rut de la persona que firme el documento
          signerOrder: signer.order,
          signerType: signer.type,
          ownerRut: signer.rut,
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
      console.log(`Archivo subido exitosamente a: ${remotePath}`);
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
  async signDocument(
    run: string,
    input: SignDocumentDto,
    imageBuffer: Express.Multer.File,
  ) {
    return this.dataSource.transaction(async (transactionalEntityManager) => {
      const { documentId } = input;
      const document = await transactionalEntityManager.findOne(Document, {
        where: { id: documentId },
        relations: ['signatures'],
      });

      if (!document) {
        throw new NotFoundException(
          `Documento con el id ${documentId} no encontrado`,
        );
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

        const { content, checksum } = await this.prepareFile(
          document.fileName,
          documentYear,
        );
        //limpieza y transformacion de run que pide la api
        const cleanRut = this.cleanRut(run);
        (cleanRut);
        const firmaResult = await this.firmaService.signdocument(
          {
            ...input,
            documentContent: content,
            documentChecksum: checksum,
          },
          cleanRut,
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

  private cleanRut(rut: string) {
    // Limpia el RUT
    let cleanRut = rut.replace(/[.-]/g, '');
    cleanRut = cleanRut.slice(0, -1);

    // Crea y retorna un nuevo objeto con el DTO original y el RUN limpio
    return cleanRut;
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
  async prepareFile(
    fileName: string,
    year: string,
  ): Promise<{ content: string; checksum: string }> {
    const remotePath = `/uploads/${year}/${fileName}`;
    try {
      const fileStream = await this.remoteStorage.getFileStream(remotePath);

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        fileStream.on('data', (chunk) => chunks.push(chunk));
        fileStream.on('end', () => {
          const fileBuffer = Buffer.concat(chunks);
          const content = fileBuffer.toString('base64');
          const checksum = this.calculateChecksum(fileBuffer);
          resolve({ content, checksum });
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
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * Obtiene un documento por su ID.
   * @param id ID del documento.
   * @returns Promesa que resuelve a la información del documento.
   * @throws BadRequestException si el ID es inválido.
   * @throws NotFoundException si el documento no se encuentra.
   */
  async getById(id: number, user: User, res: Response, action: 'view' | 'download' = 'view') {
    if (!id || isNaN(id)) {
      throw new BadRequestException(
        'ID inválido. Debe ser un número entero positivo.',
      );
    }
  
    try {
      const document = await this.documentRepository.findOne({
        where: { id },
        relations: ['signatures'],
      });
  
      if (!document) {
        throw new NotFoundException(`Documento no encontrado con id ${id}`);
      }
  
      if (user.privilegio !== Cargo.ADMIN) {
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
  
      const dateObject = new Date(document.date);
      const documentYear = dateObject.getFullYear().toString();
      const remoteFilePath = `/uploads/${documentYear}/${document.fileName}`;
  
      // Obtener el stream del archivo desde el servidor SFTP
      const fileStream = await this.remoteStorage.getFileStream(remoteFilePath);
  
      // Configurar los headers de la respuesta según la acción
      res.setHeader('Content-Type', 'application/pdf');
      if (action === 'download') {
        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      }
  
      // Transmitir el archivo al cliente
      fileStream.pipe(res);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al buscar o transmitir el documento con id ${id}: ${error.message}`,
      );
    }
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
      idDocument:number,
      id: number;
      name: string;
      fileName: string;
      signatureType: 'Titular' | 'Subrogante';
      ownerRut: string;
      fecha: Date | null;
      signatureStatus: SignatureStatus;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const delegates = await this.delegateRepository.find({
      where: { delegateRut: rut, isActive: true },
    });

    const ownerRuts = delegates.map((d) => d.ownerRut);
    ownerRuts.push(rut);

    //busca todos los documentos del funcinoario y a todos a los que delega
    const query = await this.documentRepository.createQueryBuilder('document')
    .leftJoinAndSelect('document.signatures', 'signature')
    .where(qb => {
      const subQuery = qb.subQuery()
        .select('DISTINCT(subDoc.id)')
        .from(Document, 'subDoc')
        .leftJoin('subDoc.signatures', 'subSig')
        .where('subSig.ownerRut IN (:...ownerRuts)', { ownerRuts })
        .getQuery();
      return 'document.id IN ' + subQuery;
    })
    .orderBy('document.date', 'DESC');

    


  
  if (startDate && endDate) {
    query.andWhere('document.date BETWEEN :startDate AND :endDate', { startDate, endDate });
  } else if (startDate) {
    query.andWhere('document.date >= :startDate', { startDate });
  } else if (endDate) {
    query.andWhere('document.date <= :endDate', { endDate });
  }
    if (documentName) {
      query.andWhere('document.name ILIKE :nombre', { nombre: `%${documentName}%` });
    }

    const documents = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const dataFormatted = documents.flatMap(doc => 
      doc.signatures.filter(sig => !sig.isSigned && (ownerRuts.includes(sig.ownerRut)))
      .map(sig => ({
        idDocument:doc.id,
        id: sig.id,
        name: doc.name,
        fileName: doc.fileName,
        signatureType: sig.ownerRut === rut ? 'Titular' as const : 'Subrogante' as const,
        ownerRut: sig.ownerRut,
        fecha: doc.date,
        signatureStatus: this.evaluateSignatureStatus(doc, rut, sig, delegates)
      }))
    );

    return {
      data: dataFormatted,
      total:dataFormatted.length,
      page,
      limit,
      totalPages: Math.ceil(dataFormatted.length / limit),
    };
  }

  private evaluateSignatureStatus(
    document: Document,
    rut: string,
    currentSignature: DocumentSignature,
    activeDelegations: Delegate[]
  ): SignatureStatus {
    // Verificar si la persona ya ha firmado el documento
    const alreadySigned = document.signatures.some(
      (s) => s.signerRut === rut && s.isSigned
    );

    if (alreadySigned) {
      return SignatureStatus.AlreadySigned;
    }

    // Verificar si es un delegado activo para alguna firma pendiente
    const canSignAsDelegate = activeDelegations.some(delegation =>
      document.signatures.some(s => 
        s.ownerRut === delegation.ownerRut && !s.isSigned
      )
    );

    // Verificar si es un firmante original y también un delegado activo
    const isDelegateAndOriginalSigner = 
      currentSignature.ownerRut === rut && 
      canSignAsDelegate && 
      activeDelegations.some(delegation => 
        document.signatures.some(s => 
          s.ownerRut === delegation.ownerRut && s.ownerRut !== rut && !s.isSigned
        )
      );

    if (isDelegateAndOriginalSigner) {
      return SignatureStatus.DelegateConflict;
    }
    (document.id,document.signatures)
    if (this.isMyTurnToSign(document.signatures, currentSignature)) {
      return SignatureStatus.CanSign;
    }

    return SignatureStatus.NotYourTurn;
  }

  private isMyTurnToSign(
    signatures: DocumentSignature[],
    currentSignature: DocumentSignature,
  ): boolean {
    const previousSignatures = signatures.filter(
      (s) => s.signerOrder < currentSignature.signerOrder,
    );
    return !previousSignatures.some((s) => !s.isSigned);
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
    status?: 'pending' | 'signed' | 'all',
  ): Promise<{
    data: {
      id: number;
      name: string;
      fileName: string;
      isSigned: boolean;
      signatureType: 'owner' | 'delegate';
      ownerRut: string;
      signedAt: Date | null;
    }[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    (rut);
    const delegates = await this.delegateRepository.find({
      where: { delegateRut: rut, isActive: true },
    });

    const ownerRuts = [...new Set([...delegates.map((d) => d.ownerRut), rut])];

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.signatures', 'signature')
      .where('signature.ownerRut IN (:...ownerRuts)', { ownerRuts });

    // Aplicar filtro de estado si se proporciona
    if (status === 'pending') {
      queryBuilder.andWhere('signature.isSigned = :isSigned', {
        isSigned: false,
      });
    } else if (status === 'signed') {
      queryBuilder.andWhere('signature.isSigned = :isSigned', {
        isSigned: true,
      });
    }

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
      queryBuilder.andWhere('document.name LIKE :name', {
        name: `%${documentName}%`,
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
          id: doc.id,
          name: doc.name,
          fileName: doc.fileName,
          isSigned: sig.isSigned,
          signatureType:
            sig.ownerRut === rut ? ('owner' as const) : ('delegate' as const),
          ownerRut: sig.ownerRut,
          signedAt: sig.signedAt,
        })),
    );

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  /**
   * Obtiene la información detallada de un documento por su ID.
   * @param id ID del documento.
   * @returns Promesa que resuelve a la información detallada del documento, incluyendo sus firmas.
   */
  async getInfoDocumentId(id: number) {
    return await this.documentRepository.find({
      where: { id: id },
      relations: ['signatures'],
    });
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
    // Buscar el documento con sus firmas
    const document = await this.documentRepository.findOne({
      where: { creatorRut: rut, id: idDocument, deletedAt: IsNull() },
      relations: ['signatures'],
    });

    // Verificar si el documento existe
    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Verificar si el documento ha sido firmado por un firmador
    const isSigned = document.signatures.some(
      (s) => s.isSigned && s.signerType === SignerType.FIRMADOR,
    );

    if (isSigned) {
      throw new BadRequestException(
        'No se puede eliminar un documento que ya ha sido firmado',
      );
    }

    // hacer softDelete
    await this.documentRepository.softDelete(document.id);

    return { message: 'Documento eliminado exitosamente' };
  }
}
