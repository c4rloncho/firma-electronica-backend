import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { lastValueFrom, NotFoundError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fs1 from 'fs';
import { SignResponse, SignaturePosition, SignedFile } from 'src/interfaces/firma.interfaces';
import { SignDocumentDto } from 'src/documento/dto/sign-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import * as sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { PDFDocument } from 'pdf-lib';
import { SignerType } from 'src/enums/signer-type.enum';
import { SignatureImageService } from './image-processor.service';
import { Document } from 'src/documento/entities/document.entity';
@Injectable()
export class FirmaService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private signatureImageService: SignatureImageService,
    @InjectRepository(Document)
    private readonly documentRepository:Repository<Document>
  ) {}
  /**
   * Crea la configuración para AgileSigner.
   * @param imageBuffer - Buffer de la imagen de la firma.
   * @param heightImage - Altura de la imagen de la firma.
   * @returns Promesa que resuelve a la configuración de AgileSigner en formato XML.
   */


  /**
   * Firma un documento utilizando api de firmagob firma digital.
   * @param input - Datos de entrada para la firma del documento, incluyendo el contenido  y el checksum.
   * @param imageBuffer - Buffer de la imagen de la firma.
   * @returns Promesa que resuelve a un objeto con la información de la firma realizada.
   * @throws HttpException si ocurre un error durante el proceso de firma.
   */
  async signdocument(
    input: SignDocumentDto & {
      documentBuffer: Buffer; 
      documentChecksum: string;
      funcionario: Funcionario;
      heightImage: number;
    },
    signerOrder: number,
    run: string,
    imageBuffer: Buffer,
    signerType:string,
  ) {
    const fecha = new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const token = this.generateToken(input, run);
    const pdfDoc = await PDFDocument.load(input.documentBuffer)
    const pages = pdfDoc.getPageCount(); 
    const document = await this.getDocument(input.documentId)
  // Obtener el layout y el PDF modificado
  const layout = await this.signatureImageService.createSignatureLayout(
    imageBuffer,
    input.funcionario,
    fecha,
    input.heightImage,
    signerOrder,
    pages,
    signerType,
    document.totalSigners,
    document.totalValidator,
  );
  const documentContent = input.documentBuffer.toString('base64');
    const payload = {
      api_token_key: this.configService.get<string>('API_TOKEN_KEY'),
      token,
      files: [
        {
          description: 'descripción',
          checksum: input.documentChecksum,
          content: documentContent,
          'content-type': 'application/pdf',
          layout: layout,
        },
      ],
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (input.isAttended && input.otp) {
      headers['OTP'] = input.otp;
    }

    const requestInfo = {
      url: this.configService.get<string>('API_URL'),
      method: 'POST',
      headers: headers,
      body: payload,
    };
    // Guardar en archivo JSON
    fs1.writeFileSync('request-log.json', JSON.stringify(requestInfo, null, 2));


    try {
      const response = await lastValueFrom(
        this.httpService.post(
          this.configService.get<string>('API_URL'),
          payload,
          { headers },
        ),
      );
      const processedResponse = this.processResponse(response.data);
      return {
        success: true,
        signatureInfo: processedResponse,
      };
    } catch (error) {
      throw new HttpException(
        `Error en la firma digital: ${error.response?.data?.error || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getDocument(id:number){
    const document = await this.documentRepository.findOne({where:{id}})
    if(!document){throw new NotFoundException('documento no encontrado')}
    return document
  }

    /**
   * Genera un token JWT para la firma del documento.
   * @param input - Datos de entrada para la firma del documento.
   * @returns Token JWT generado.
   */
    private generateToken(input: SignDocumentDto, run: string) {
      const now = new Date();
      const expirationDate = new Date(now.getTime() + 30 * 60 * 1000);
      const formattedExpiration = expirationDate
        .toLocaleString('sv', { timeZone: 'America/Santiago' })
        .replace(' ', 'T');
  
      return this.jwtService.sign(
        {
          run: run,
          entity: input.entity,
          purpose: input.purpose,
          expiration: formattedExpiration,
        },
   
      );
    }
  /**
   * Procesa la respuesta del servicio de firma digital.
   * @param responseData - Datos de respuesta del servicio de firma.
   * @returns Objeto con los archivos firmados procesados y metadatos adicionales.
   * @throws HttpException si la respuesta del servicio de firma es inválida.
   */
  private processResponse(responseData: SignResponse): {
    signedFiles: {
      content: Buffer;
      checksum: string;
      contentType: string;
      description: string | null;
      status: string;
      documentStatus: string;
    }[];
    metadata: SignResponse['metadata'];
    idSolicitud: number;
  } {
    if (!responseData.files || !Array.isArray(responseData.files)) {
      throw new HttpException(
        'Respuesta inválida del servicio de firma',
        HttpStatus.BAD_REQUEST,
      );
    }

    const signedFiles = responseData.files.map((file) => ({
      content: Buffer.from(file.content, 'base64'),
      checksum: file.checksum_signed,
      contentType: file.contentType,
      description: file.description,
      status: file.status,
      documentStatus: file.documentStatus,
    }));

    return {
      signedFiles,
      metadata: responseData.metadata,
      idSolicitud: responseData.idSolicitud,
    };
  }
}
