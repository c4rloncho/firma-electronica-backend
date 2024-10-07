import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { lastValueFrom, NotFoundError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SignResponse, SignedFile } from 'src/interfaces/firma.interfaces';
import { SignDocumentDto } from 'src/documento/dto/sign-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';

@Injectable()
export class FirmaService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,


  ) {}
  /**
   * Crea la configuración para AgileSigner.
   * @param imageBuffer - Buffer de la imagen de la firma.
   * @param heightImage - Altura de la imagen de la firma.
   * @returns Promesa que resuelve a la configuración de AgileSigner en formato XML.
   */
  private async createAgileSignerConfig(
    imageBuffer: Express.Multer.File,
    heightImage: number,
  ) {
    const imageBase64 = imageBuffer.buffer.toString('base64');
    const width = 130;
    const height = 80;
    const pageHeight = 1008;
    const pageWidth = 612;
  
    let yPosition = Math.max(0, Math.min(30, heightImage));
    if (yPosition < 0 || yPosition > 30) {
      yPosition = 0;
    }
    const scaledY = pageHeight - (yPosition / 30) * (pageHeight - height) - height;
    const llx = 20;
    const lly = Math.round(scaledY);
    const urx = llx + width;
    const ury = lly + height;
  
    return `<AgileSignerConfig>
      <Application id="THIS-CONFIG">
        <pdfPassword></pdfPassword>
        <Signature>
          <Visible active="true" layer2="false" label="true" pos="1">
            <llx>${llx}</llx>
            <lly>${lly}</lly>
            <urx>${urx}</urx>
            <ury>${ury}</ury>
            <page>LAST</page>
            <image>BASE64</image>
            <BASE64VALUE>${imageBase64}</BASE64VALUE>
          </Visible>
        </Signature>
      </Application>
    </AgileSignerConfig>`;
  }
  /**
   * Genera un token JWT para la firma del documento.
   * @param input - Datos de entrada para la firma del documento.
   * @returns Token JWT generado.
   */
  private generateToken(input: SignDocumentDto,run:string) {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 30 * 60 * 1000);
    const formattedExpiration = expirationDate
      .toLocaleString('sv', { timeZone: 'America/Santiago' })
      .replace(' ', 'T');

    return this.jwtService.sign({
      run: run,
      entity: input.entity,
      purpose: input.purpose,
      expiration: formattedExpiration,
    });
  }
  /**
   * Firma un documento utilizando api de firmagob firma digital.
   * @param input - Datos de entrada para la firma del documento, incluyendo el contenido  y el checksum.
   * @param imageBuffer - Buffer de la imagen de la firma.
   * @returns Promesa que resuelve a un objeto con la información de la firma realizada.
   * @throws HttpException si ocurre un error durante el proceso de firma.
   */
  async signdocument(
    input: SignDocumentDto & { documentContent: string; documentChecksum: string },
    run:string,
    imageBuffer: Express.Multer.File,
  ) {
    const token = this.generateToken(input,run);
    const altura = input.heightImage ? parseInt(input.heightImage.toString(), 10) : 0;
    const layout = await this.createAgileSignerConfig(imageBuffer, altura);
    const payload = {
      api_token_key: this.configService.get<string>('API_TOKEN_KEY'),
      token,
      files: [
        {
          'content-type': 'application/pdf',
          content: input.documentContent,
          description: 'Documento para firmar',
          layout: layout,
          checksum: input.documentChecksum,
        },
      ],
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (input.isAttended && input.otp) {
      headers['OTP'] = input.otp;
    }

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
      throw new HttpException('Respuesta inválida del servicio de firma', HttpStatus.BAD_REQUEST);
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