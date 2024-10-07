import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseArrayPipe,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
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
import { AuthGuard } from '@nestjs/passport';
import { CargosGuard } from 'src/auth/cargos.guard';
import { Cargos } from 'src/auth/cargos.decorator';
import { Cargo } from 'src/auth/dto/cargo.enum';

@Controller('document')
export class DocumentoController {
  private readonly logger = new Logger(DocumentoController.name);
  constructor(
    private readonly documentoService: DocumentoService,
    private configService: ConfigService,
  ) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  async createDocument(
    @Req() req,
    @Body() createDocumentDto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const creatorRut = req.user.rut;
    if (!file) {
      throw new HttpException(
        'No se ha proporcionado ningún archivo',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const document = await this.documentoService.createDocument(
        creatorRut,
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
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('image'))
  async signDocument(
    @Req() req,
    @Body() signDocumentDto: SignDocumentDto,
    @UploadedFile() imageFile: Express.Multer.File,
  ) {
    const rut = req.user.rut;
    if (!imageFile) {
      throw new BadRequestException('La imagen de firma es requerida');
    }

    try {
      const result = await this.documentoService.signDocument(
        rut,
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

  @Get('full-signed')
  @UseGuards(AuthGuard('jwt'),CargosGuard)
  @Cargos(Cargo.ADMIN)
  async getFullySigned(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string
  ) {
    try {
      return await this.documentoService.findFullySigned(page, limit, startDate, endDate, name);
    } catch (error) {
      throw error;
    }
  }

  @Get('get-by-id/:id')
  @UseGuards(AuthGuard('jwt'))
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

  @Delete(':rut/:idDocument')
  async deleteDocument(
    @Param('rut') rut: string,
    @Param('idDocument',ParseIntPipe) idDocument: number
  ) {
    try {
      return await this.documentoService.deleteDocument(rut, idDocument);
    } catch (error) {
      console.error('Error al eliminar el documento:', error);
      throw new HttpException('No se pudo eliminar el documento', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
