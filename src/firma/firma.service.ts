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
import { SignResponse, SignaturePosition, SignedFile } from 'src/interfaces/firma.interfaces';
import { SignDocumentDto } from 'src/documento/dto/sign-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import * as sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { PDFDocument } from 'pdf-lib';
import { SignerType } from 'src/enums/signer-type.enum';
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
    heightImage: number = 30  
  ): Promise<Buffer> {
    try {
      const scale = 2;
      // Usar heightImage para el tamaño del logo
      const logoHeight = heightImage;  // Altura según parámetro
      const logoWidth = heightImage;   // Mantener proporción cuadrada
      const padding = 10;
  
      const measureCanvas = createCanvas(1, 1);
      const measureCtx = measureCanvas.getContext('2d');
      const fontScale = heightImage / 70; // Escalar fuente en proporción a la altura
  
      measureCtx.font = `bold ${12 * fontScale}px Arial`;
      const nombreWidth = measureCtx.measureText(funcionario.nombre).width;
      
      measureCtx.font = `${10 * fontScale}px Arial`;
      const cargoWidth = measureCtx.measureText(funcionario.cargo).width;
      
      measureCtx.font = `${9 * fontScale}px Arial`;
      const fechaWidth = measureCtx.measureText(fecha).width;
  
      const maxTextWidth = Math.max(nombreWidth, cargoWidth, fechaWidth);
      const totalWidth = logoWidth + padding + maxTextWidth + 30;
      const totalHeight = logoHeight;
  
      const canvas = createCanvas(totalWidth * scale, totalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      
      const logo = await loadImage(imageBuffer);
      ctx.drawImage(logo, 0, 0, logoWidth, logoHeight);
  
      const startX = logoWidth + padding;
      const lineHeight = logoHeight / 4;
  
      ctx.font = `bold ${12 * fontScale}px Arial`;
      ctx.fillStyle = '#000000';
      ctx.fillText(funcionario.nombre, startX, lineHeight);
  
      ctx.font = `${10 * fontScale}px Arial`;
      ctx.fillStyle = '#444444';
      ctx.fillText(funcionario.cargo, startX, lineHeight * 2);
  
      ctx.font = `${9 * fontScale}px Arial`;
      ctx.fillStyle = '#666666';
      ctx.fillText(fecha, startX, lineHeight * 3);
  
      return canvas.toBuffer('image/png');
    } catch (error) {
      console.error('Error adding text to image:', error);
      throw error;
    }
  }
  
  async createAgileSignerConfig(
    imageBuffer: Express.Multer.File,
    heightImage: number,
    funcionario: Funcionario,
    signerOrder: number,
    fecha: string,
    pdfBuffer: Buffer,
    signerType: string,
  ): Promise<{ layout: string; modifiedPdfBuffer: Buffer }> {
    try {
      let base64Image;
  
      if (signerType === SignerType.VISADOR) {
        const canvas = createCanvas(70, 70);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 70, 70);
        
        const iniciales = funcionario.nombre
          .split(' ')
          .map(nombre => nombre[0])
          .join('')
          .toUpperCase();
  
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iniciales, 35, 35);
  
        base64Image = canvas.toBuffer('image/png').toString('base64');
      } else {
        const imageWithText = await this.addTextToImage(
          imageBuffer.buffer,
          fecha,
          funcionario,
          heightImage
        );
        base64Image = imageWithText.toString('base64');
      }
  
      // Configuración de dimensiones
      const marginLeft = 40;
      const signatureWidth = 200;
      const signatureHeight = 100;
      const spaceBetweenSignatures = 40;
      const spaceBetweenRows = 40;
      const signaturesPerRow = 2;
      const maxRowsPerPage = 3;
  
      // Calcular la posición de la firma y obtener el PDF modificado
      const { position, modifiedPdfBuffer } = await this.calculateSignaturePosition(
        pdfBuffer,
        signerOrder,
        {
          marginLeft,
          signatureWidth,
          signatureHeight,
          spaceBetweenSignatures,
          spaceBetweenRows,
          signaturesPerRow,
          maxRowsPerPage,
          heightImage,
        }
      );
  
      const layout = `<AgileSignerConfig>
        <Application id="THIS-CONFIG">
          <pdfPassword/>
          <Signature>
            <Visible active="true" layer2="false" label="true" pos="1">
              <llx>${position.llx}</llx>
              <lly>${position.lly}</lly>
              <urx>${position.urx}</urx>
              <ury>${position.ury}</ury>
              <page>${position.page}</page>
              <image>BASE64</image>
              <BASE64VALUE>${base64Image}</BASE64VALUE>
            </Visible>
          </Signature>
        </Application>
      </AgileSignerConfig>`;
  
      return { layout, modifiedPdfBuffer };
    } catch (error) {
      console.error('Error creating AgileSigner config:', error);
      throw error;
    }
  }
  
  private async calculateSignaturePosition(
    pdfBuffer: Buffer,
    signerOrder: number,
    config: {
        marginLeft: number;
        signatureWidth: number;
        signatureHeight: number;
        spaceBetweenSignatures: number;
        spaceBetweenRows: number;
        signaturesPerRow: number;
        maxRowsPerPage: number;
        heightImage: number;
    }
): Promise<{ position: SignaturePosition; modifiedPdfBuffer: Buffer }> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    
    // Calculamos cuántas firmas caben por página
    const signaturesPerPage = config.signaturesPerRow * config.maxRowsPerPage;
    
    // Calculamos la página y la posición de la firma
    const pageIndex = Math.floor((signerOrder - 1) / signaturesPerPage);
    const signatureIndexInPage = (signerOrder - 1) % signaturesPerPage;
    
    // Verificamos si necesitamos agregar nuevas páginas
    while (pdfDoc.getPageCount() < pageIndex + 1) {
        const templatePage = pdfDoc.getPage(0);
        pdfDoc.addPage([templatePage.getWidth(), templatePage.getHeight()]);
    }

    const currentPage = pdfDoc.getPage(pageIndex);
    const { width: pageWidth, height: pageHeight } = currentPage.getSize();

    // Calculamos la fila y columna dentro de la página
    const row = Math.floor(signatureIndexInPage / config.signaturesPerRow);
    const column = signatureIndexInPage % config.signaturesPerRow;

    // Calculamos el espacio total disponible para firmas
    const totalWidthAvailable = pageWidth - (2 * config.marginLeft);
    const signatureBlockWidth = config.signatureWidth + config.spaceBetweenSignatures;
    
    // Centramos las firmas en la página horizontalmente
    const startX = config.marginLeft + 
        (totalWidthAvailable - (config.signaturesPerRow * signatureBlockWidth)) / 2;

    // Coordenadas X (izquierda a derecha)
    const llx = startX + (column * signatureBlockWidth);
    const urx = llx + config.signatureWidth;

    // Coordenadas Y (desde abajo hacia arriba)
    const marginBottom = config.heightImage; // Usamos heightImage como margen inferior
    const signatureBlockHeight = config.signatureHeight + config.spaceBetweenRows;
    const bottomStartY = marginBottom + (config.maxRowsPerPage - 1) * signatureBlockHeight;
    
    // Calculamos desde abajo, invirtiendo el orden de las filas
    const invertedRow = config.maxRowsPerPage - 1 - row;
    const lly = marginBottom + (invertedRow * signatureBlockHeight);
    const ury = lly + config.signatureHeight;

    const pdfBytes = await pdfDoc.save();

    return {
        position: {
            llx,
            lly,
            urx,
            ury,
            page: pageIndex + 1,
        },
        modifiedPdfBuffer: Buffer.from(pdfBytes)
    };
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
      documentBuffer: Buffer; 
      documentChecksum: string;
      funcionario: Funcionario;
      heightImage: number;
    },
    signerOrder: number,
    run: string,
    imageBuffer: Express.Multer.File,
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
    console.log(token)
  // Obtener el layout y el PDF modificado
  const { layout, modifiedPdfBuffer } = await this.createAgileSignerConfig(
    imageBuffer,
    input.heightImage,
    input.funcionario,
    signerOrder,
    fecha,
    input.documentBuffer,
    signerType,
  );

  const documentContent = modifiedPdfBuffer.toString('base64');
    const payload = {
      api_token_key: this.configService.get<string>('API_TOKEN_KEY'),
      token,
      files: [
        {
          description: 'descripcion',
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
