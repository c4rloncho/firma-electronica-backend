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
import { DelegateSignDto } from './dto/delegate-sign.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Delegate } from 'src/funcionario/entities/delegado.entity';
import { Repository } from 'typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';

@Injectable()
export class FirmaService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Delegate, 'secondConnection')
    private readonly delegateRepository:Repository<Delegate>,
    @InjectRepository(Funcionario,'default')
    private readonly funcionarioRepository:Repository<Funcionario>

  ) {}

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

  private generateToken(input: SignDocumentDto) {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 30 * 60 * 1000);
    const formattedExpiration = expirationDate
      .toLocaleString('sv', { timeZone: 'America/Santiago' })
      .replace(' ', 'T');

    return this.jwtService.sign({
      run: input.run,
      entity: input.entity,
      purpose: input.purpose,
      expiration: formattedExpiration,
    });
  }

  async signdocument(
    input: SignDocumentDto & { documentContent: string; documentChecksum: string },
    imageBuffer: Express.Multer.File,
  ) {
    const token = this.generateToken(input);
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


  async delegateSign(input: DelegateSignDto): Promise<Delegate> {
    const { ownerRut, delegateRut } = input;

    const [owner, delegate] = await Promise.all([
      this.funcionarioRepository.findOne({ where: { rut: ownerRut } }),
      this.funcionarioRepository.findOne({ where: { rut: delegateRut } }),
    ]);

    if (!owner || !delegate) {
      throw new NotFoundException('Uno o ambos RUTs ingresados son incorrectos');
    }

    const existingDelegate = await this.delegateRepository.findOne({ where: { ownerRut: ownerRut } });
    if (existingDelegate) {
      throw new BadRequestException('Solo puedes delegar a una persona. Elimina la anterior para agregar una nueva.');
    }

    const newDelegate = this.delegateRepository.create({
      createdAt: new Date(),
      delegateRut: delegateRut,
      ownerRut: ownerRut,
    });

    return this.delegateRepository.save(newDelegate);
  }
 
}