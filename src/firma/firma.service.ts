import {
  BadRequestException,
  HttpException,
  HttpStatus,
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
import { SignResponse, SignedFile } from 'src/interfaces/firma.interfaces';
import { SignDocumentDto } from 'src/documento/dto/sign-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import * as sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
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
  async addTextToImage(
    imageBuffer: Buffer,
    fecha: string,
    funcionario: Funcionario,
    heightImage?: number
  ): Promise<Buffer> {
    try {
      // Factor de escala para mejor resolución
      const scale = 4;
      
      // Dimensiones base
      const logoWidth = heightImage || 70; // Use heightImage if provided, otherwise default to 70
      const logoHeight = heightImage || 70; // Use heightImage for height as well
      const padding = 8;
      const totalHeight = heightImage || 70; // Adjust total height based on provided height
  
      // Crear un canvas temporal para medir el texto
      const measureCanvas = createCanvas(1, 1);
      const measureCtx = measureCanvas.getContext('2d');
  
      // Configurar fuentes para medición - ajustar tamaños de fuente proporcionalmente
      const fontScale = heightImage ? (heightImage / 70) : 1; // Scale fonts based on height
      
      measureCtx.font = `bold ${8 * fontScale}px Arial`;
      const nombreWidth = measureCtx.measureText(funcionario.nombre).width;
      
      measureCtx.font = `${7 * fontScale}px Arial`;
      const cargoWidth = measureCtx.measureText(funcionario.cargo).width;
      
      measureCtx.font = `${6.5 * fontScale}px Arial`;
      const fechaWidth = measureCtx.measureText(fecha).width;
  
      // Calcular el ancho necesario con margen extra para evitar cortes
      const maxTextWidth = Math.max(nombreWidth, cargoWidth, fechaWidth);
      const totalWidth = logoWidth + padding + maxTextWidth + 25;
  
      // Crear el canvas final con las dimensiones calculadas
      const canvas = createCanvas(totalWidth * scale, totalHeight * scale);
      const ctx = canvas.getContext('2d');
  
      // Configurar la calidad del renderizado
      ctx.patternQuality = 'best';
      ctx.quality = 'best';
      ctx.antialias = 'default';
      
      // Escalar para mejor resolución
      ctx.scale(scale, scale);
  
      // Cargar y dibujar el logo
      const logoImage = await loadImage(imageBuffer);
      ctx.drawImage(logoImage, 0, 0, logoWidth, logoHeight);
  
      // Posición inicial del texto - ajustar basado en la altura
      const startX = logoWidth + padding;
      const textSpacing = heightImage ? (heightImage / 7) : 10; // Adjust text spacing based on height
      
      // Dibujar nombre
      ctx.font = `bold ${8 * fontScale}px Arial`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.fillText(funcionario.nombre, startX, textSpacing);
  
      // Dibujar cargo
      ctx.font = `${7 * fontScale}px Arial`;
      ctx.fillStyle = '#444444';
      ctx.fillText(funcionario.cargo, startX, textSpacing * 2.2);
  
      // Dibujar fecha
      ctx.font = `${6.5 * fontScale}px Arial`;
      ctx.fillStyle = '#666666';
      ctx.fillText(fecha, startX, textSpacing * 3.2);
  
      // Convertir a Buffer con máxima calidad
      return Buffer.from(canvas.toBuffer('image/png', {
        compressionLevel: 0,
        filters: canvas.PNG_FILTER_NONE
      }));
    } catch (error) {
      console.error('Error al agregar texto a la imagen:', error);
      throw error;
    }
  }

async createAgileSignerConfig(
  imageBuffer: Express.Multer.File,
  heightImage: number,
  funcionario: Funcionario,
  signerOrder: number,
  fecha: string,
): Promise<string> {
  const imageWithText = await this.addTextToImage(
    imageBuffer.buffer,
    fecha,
    funcionario,
    heightImage 
  );

  const imageBase64 = imageWithText.toString('base64');
  
  const tempImage = await loadImage(imageWithText);
  const width = tempImage.width / 4;
  const height = tempImage.height / 4;
  
  // Configuración de página y espaciado
  const pageHeight = 1008;
  const pageWidth = 612;
  const marginBottom = 50;
  const marginLeft = 40;
  const spacingBetweenSignatures = 20;
  const firmasPerRow = 2;
  
  // Calcular posición basada en el orden de firma
  const row = Math.floor((signerOrder - 1) / firmasPerRow);
  const column = (signerOrder - 1) % firmasPerRow;
  
  // Calcular coordenadas X
  const llx = marginLeft + (column * (width + spacingBetweenSignatures));
  const urx = llx + width;
  
  // Calcular coordenadas Y y página
  const firmasPerPage = Math.floor((pageHeight - marginBottom) / (height + spacingBetweenSignatures));
  const rowsPerPage = Math.floor(firmasPerPage / firmasPerRow);
  const currentPage = Math.floor(row / rowsPerPage) + 1;
  const adjustedRow = row % rowsPerPage;
  
  // Calcular Y desde abajo hacia arriba
  const baseY = pageHeight - marginBottom - ((adjustedRow + 1) * (height + spacingBetweenSignatures));
  const lly = baseY;
  const ury = lly + height;

  return `<AgileSignerConfig>
      <Application id=\"THIS-CONFIG\">
          <pdfPassword/>
          <Signature>
              <Visible active=\"true\" layer2=\"false\" label=\"true\" pos=\"1\">
                  <llx>${llx}</llx>
                  <lly>${lly}</lly>
                  <urx>${urx}</urx>
                  <ury>${ury}</ury>
                  <page>${currentPage}</page>
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
   * Firma un documento utilizando api de firmagob firma digital.
   * @param input - Datos de entrada para la firma del documento, incluyendo el contenido  y el checksum.
   * @param imageBuffer - Buffer de la imagen de la firma.
   * @returns Promesa que resuelve a un objeto con la información de la firma realizada.
   * @throws HttpException si ocurre un error durante el proceso de firma.
   */
  async signdocument(
    input: SignDocumentDto & {
      documentContent: string;
      documentChecksum: string;
      funcionario: Funcionario;
      heightImage:number;
    },
    signerOrder:number,
    run: string,
    imageBuffer: Express.Multer.File,
  ) {
    const fecha = new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const token = this.generateToken(input, run);
    const altura = input.heightImage
    ? Math.max(30, Math.min(200, parseInt(input.heightImage.toString(), 10)))
    : 70; 
    const layout = await this.createAgileSignerConfig(
      imageBuffer,
      altura,
      input.funcionario,
      signerOrder,
      fecha,
    );
    const payload = {
      api_token_key: this.configService.get<string>('API_TOKEN_KEY'),
      token,
      files: [
        {
          description: 'descripcion',
          checksum: input.documentChecksum,
          content: input.documentContent,
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

    // Guardar en archivo TXT
    fs1.writeFileSync(
      'request-log.txt',
      `Request a API externa:\n` +
        `URL: ${requestInfo.url}\n` +
        `Method: ${requestInfo.method}\n` +
        `Headers: ${JSON.stringify(headers, null, 2)}\n` +
        `Body: ${JSON.stringify(payload, null, 2)}`,
    );
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
