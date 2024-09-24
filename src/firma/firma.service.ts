import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SingDocumentDto } from './dto/generar-token.dto';
import { Sign } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';




interface SignedFile {
  content: string;
  status: string;
  contentType: string;
  description: string | null;
  checksum_original: string;
  checksum_signed: string;
  documentStatus: string;
}

interface SignResponse {
  files: SignedFile[];
  metadata: {
    otpExpired: boolean;
    filesSigned: number;
    signedFailed: number;
    objectsReceived: number;
  };
  idSolicitud: number;
}

@Injectable()
export class FirmaService {
  constructor(
    private readonly jwtservice: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}


  
  private async prepareFile(
    file: Express.Multer.File,
  ): Promise<{ content: string; checksum: string }> {
    const content = file.buffer.toString('base64');
    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');
    return { content, checksum };
  }
  private async createAgileSignerConfig(
    imageBuffer: Express.Multer.File,
    heightImage: number,

  ) {
    const fecha = new Date();
    const fechaFirma = fecha.toLocaleDateString('es-CL');
    const imageBase64 = imageBuffer.buffer.toString('base64');
    // Tamaño fijo para el logo
    const width = 130; // Ancho fijo del logo
    const height = 80; // Alto fijo del logo
    //dimension de una pagina oficio  8.5 x 14 pulgadas.
    const pageHeight = 1008;
    const pageWidth = 612;
  
    let yPosition = Math.max(0, Math.min(30, heightImage));
    if (yPosition < 0 || yPosition > 30) { //valor predeterminado si no cumple
      yPosition = 0;
    }
    const scaledY =
      pageHeight - (yPosition / 30) * (pageHeight - height) - height;
    const llx = 20; // Margen izquierdo fijo
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

  private generateToken(input: SingDocumentDto) {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 30 * 60 * 1000); // 25 minutos desde ahora
    const formattedExpiration = expirationDate
      .toLocaleString('sv', { timeZone: 'America/Santiago' })
      .replace(' ', 'T');

    return this.jwtservice.sign({
      run: input.run,
      entity: input.entity,
      purpose: input.purpose,
      expiration: formattedExpiration,
    });
  }
  async signdocument(
    input: SingDocumentDto,
    fileBuffer: Express.Multer.File,
    imageBuffer: Express.Multer.File,
  ) {
    const token = this.generateToken(input);
    const { content, checksum } = await this.prepareFile(fileBuffer);
    const altura = parseInt(input.heightImage, 10);
    const layout = await this.createAgileSignerConfig(imageBuffer, altura);
    const payload = {
      api_token_key: this.configService.get<string>('API_TOKEN_KEY'),
      token,
      files: [
        {
          'content-type': 'application/pdf',
          content,
          description: 'Documento para firmar',
          layout: layout,
          checksum,
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
      const savedPaths = await this.saveSignedFiles(
        processedResponse.signedFiles,
      );

      return {
        ...processedResponse,
        savedPaths,
      };
    } catch (error) {
      throw new HttpException(
        `Error en la firma digital: ${error.response?.data?.error || error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
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
  private async saveSignedFiles(signedFiles: any[]): Promise<string[]> {
    const savedPaths: string[] = [];
    for (let i = 0; i < signedFiles.length; i++) {
      const file = signedFiles[i];
      const fechaHora = new Date().toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
      const fileName = `documento_firmado_${fechaHora}_${i}.pdf`;
      console.log(fechaHora)
      const filePath = path.join(
        'C:',
        'Users',
        'qarlo',
        'Documents',
        'practica',
        'firmados',
        fileName,
      );
      await fs.writeFile(filePath, file.content);
      savedPaths.push(filePath);
    }
    return savedPaths;
  }
}
