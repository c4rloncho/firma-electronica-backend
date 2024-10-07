import { Injectable } from '@nestjs/common';
import { SignDocumentDto } from './dto/sign-document.dto';
import * as crypto from 'crypto';

@Injectable()
export class MockFirmaService {
  async signdocument(
    input: SignDocumentDto & { documentContent: string; documentChecksum: string },
    run:string,
    imageBuffer: Express.Multer.File
  ): Promise<{
    success: boolean;
    signatureInfo: {
      signedFiles: {
        content: Buffer;
        checksum: string;
        contentType: string;
        description: string;
        status: string;
        documentStatus: string;
      }[];
      metadata: {
        signerName: string;
        signerRut: string;
        signatureDate: string;
        signatureType: string;
        certificateSerialNumber: string;
        certificateIssuer: string;
      };
      idSolicitud: number;
    };
  }> {
    // Simular un pequeño retraso para imitar una llamada a API real
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generar un nuevo checksum simulado
    const newChecksum = crypto.createHash('md5').update(input.documentContent).digest('hex');

    // Simular la firma del documento
    const signedContent = Buffer.from(`${input.documentContent} - Firmado por ${run}`);

    return {
      success: true,
      signatureInfo: {
        signedFiles: [
          {
            content: signedContent,
            checksum: newChecksum,
            contentType: "application/pdf",
            description: "Documento firmado (simulado)",
            status: "OK",
            documentStatus: "SIGNED"
          }
        ],
        metadata: {
          signerName: `Firmante ${run}`,
          signerRut: run,
          signatureDate: new Date().toISOString(),
          signatureType: "ADVANCED",
          certificateSerialNumber: crypto.randomBytes(8).toString('hex').toUpperCase(),
          certificateIssuer: "Autoridad de Certificación Simulada"
        },
        idSolicitud: Math.floor(Math.random() * 1000000)
      }
    };
  }
}