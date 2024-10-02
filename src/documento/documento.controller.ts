import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
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
import { createReadStream, existsSync } from 'fs';
import { Response } from 'express';

@Controller('document')
export class DocumentoController {
  private readonly logger = new Logger(DocumentoController.name);
  constructor(
    private readonly documentoService: DocumentoService,
    private configService: ConfigService,
  ) {}

  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async createDocument(
    @Body() createDocumentDto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new HttpException(
        'No se ha proporcionado ningún archivo',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const document = await this.documentoService.createDocument(
        createDocumentDto,
        file,
      );
      return {
        message: 'Documento creado exitosamente',
        document,
      };
    } catch (error) {
      console.error('Error al crear el documento:', error);

      if (error.message.includes('Failed to save file')) {
        throw new HttpException(
          'Error al guardar el archivo',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        throw new HttpException(
          'Error al crear el documento',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Post('sign')
  @UseInterceptors(FileInterceptor('image'))
  async signDocument(
    @Body() signDocumentDto: SignDocumentDto,
    @UploadedFile() imageFile: Express.Multer.File,
  ) {
    if (!imageFile) {
      throw new BadRequestException('La imagen de firma es requerida');
    }

    try {
      const result = await this.documentoService.signDocument(
        signDocumentDto,
        imageFile,
      );
      return {
        message: 'Documento firmado exitosamente',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al firmar el documento: ${error.message}`,
      );
    }
  }

  @Get('get-by-id/:id')
  async getDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      const document = await this.documentoService.getById(id);
      const filePath = join(process.cwd(), document.filePath);

      // Verificar si el archivo existe
      if (!existsSync(filePath)) {
        throw new NotFoundException(
          `El archivo ${document.fileName} no se encuentra en el servidor.`,
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.fileName}"`,
      );
      createReadStream(filePath).pipe(res);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof NotFoundException) {
        throw error;
      } else if (error instanceof InternalServerErrorException) {
        throw error;
      } else {
        throw new InternalServerErrorException(
          `Un error inesperado ocurrió al procesar la solicitud: ${error.message}`,
        );
      }
    }
  }

  @Get('get-info-document/:id')
  async(@Param('id', ParseIntPipe) id: number) {
    try {
      return this.documentoService.getInfoDocumentId(id);
    } catch (error) {}
  }
  @Get('get-pending/:rut')
  async getFirmasPendientePorFuncionario(
    @Param('rut') rut: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    try {
      const result = await this.documentoService.getPendingSignatures(
        rut,
        page,
        limit,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        name,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error al obtener firmas pendientes: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Error al obtener firmas pendientes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('by-rut/:rut')
  async getAllDocumentsByRut(
    @Param('rut') rut: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    try {
      const result = await this.documentoService.getAllDocumentsByRut(
        rut,
        page,
        limit,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        name,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error al obtener documentos por RUT: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Error al obtener documentos',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

}
