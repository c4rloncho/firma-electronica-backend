import { Body, Controller, Post, UploadedFiles, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SingDocumentDto } from './dto/generar-token.dto';

@Controller('firma')
export class FirmaController {
  constructor(private readonly firmaService: FirmaService) {}

  @Post('sign')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]))
  async generarfirma(
    @UploadedFiles() files: { file?: Express.Multer.File[], image?: Express.Multer.File[] },
    @Body() input: SingDocumentDto
  ) {
    
    if (!files.file || !files.image) {
      throw new HttpException('Se requieren tanto el documento como la imagen de firma', HttpStatus.BAD_REQUEST);
    }

    const documentFile = files.file[0];
    const signatureImage = files.image[0];

    try {
      return await this.firmaService.signdocument(input, documentFile, signatureImage);
    } catch (error) {
      throw new HttpException(
        `Error al firmar el documento: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}