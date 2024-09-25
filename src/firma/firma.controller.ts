import { Body, Controller, Post, UploadedFiles, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SingDocumentDto } from './dto/generar-token.dto';

@Controller('firma')
export class FirmaController {
  constructor(private readonly firmaService: FirmaService) {}

  
  @Post('sign')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image', maxCount: 1 }
  ]))
  async generarfirma(
    @UploadedFiles() files: { image?: Express.Multer.File[] },
    @Body() input: SingDocumentDto
  ) {
    if (!files.image) {
      throw new HttpException('Se requiere la imagen de firma', HttpStatus.BAD_REQUEST);
    }

    if (!input.documentId) {
      throw new HttpException('Se requiere el ID del documento', HttpStatus.BAD_REQUEST);
    }

    const signatureImage = files.image[0];
    const documentId = parseInt(input.documentId, 10);

    if (isNaN(documentId)) {
      throw new HttpException('El ID del documento debe ser un número válido', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.firmaService.signdocument(input, documentId, signatureImage);
    } catch (error) {
      throw new HttpException(
        `Error al firmar el documento: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}