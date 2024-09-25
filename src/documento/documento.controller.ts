import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { SignDocumentDto } from './dto/sign-document.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { Response } from 'express';

@Controller('document')
export class DocumentoController {
  constructor(
    private readonly documentoService: DocumentoService,
    private configService:ConfigService,
  ) {}

  @Post('create')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async createDocument(
    @Body() createDocumentDto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentoService.createDocument(createDocumentDto, file);
  }
  
  @Post('sign')
  @UseInterceptors(FileInterceptor('image'))
  async signDocument(
    @Body() signDocumentDto: SignDocumentDto,
    @UploadedFile() imageFile: Express.Multer.File
  ) {
    if (!imageFile) {
      throw new BadRequestException('La imagen de firma es requerida');
    }

    try {
      const result = await this.documentoService.signDocument(signDocumentDto, imageFile);
      return {
        message: 'Documento firmado exitosamente',
        data: result
      };
    } catch (error) {
      throw new BadRequestException(`Error al firmar el documento: ${error.message}`);
    }
  }

  @Get('get-by-id/:id')
  async getDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response
  ) {
    try {
      const document = await this.documentoService.getById(id);
      const filePath = join(process.cwd(), document.filePath);
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
  
      createReadStream(filePath).pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Un error ocurrió en la búsqueda del documento',
      );
    }
  }
  @Get('get-pending/:rut')
  async getFirmasPendientePorFuncionario(@Param('rut')rut:string){
    try {
      return this.documentoService.buscarFirmasPendientes(rut);
    } catch (error) {
      
    }
  }
}
