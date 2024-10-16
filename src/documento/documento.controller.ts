import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
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
import { User } from 'src/interfaces/firma.interfaces';

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
        throw error
      }
    }
  }


  //firmar un documento 
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


  //solo pueden ingresar usuarios con privilegios 'a' Administradores
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


  //logica actualizada para que solo puedan acceder al documento los administradores , creador del documento o firmantes
  @Get('get-by-id/:id')
  @UseGuards(AuthGuard('jwt'))
  async getDocumentById(
    @Req() req,
    @Query('action') action: 'view' | 'download',
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const user: User = req.user;
    try {
      // Ahora pasamos la respuesta (res) al servicio
      await this.documentoService.
      getById(id, user, res,action);
    } catch (error) {
      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof InternalServerErrorException) {
        throw error;
      } else {
        throw new InternalServerErrorException(
          `Un error inesperado ocurrió al procesar la solicitud: ${error.message}`,
        );
      }
    }
  }


  //obtener la informacion de un documento por su id
  @Get('get-info-document/:id')
  @UseGuards(AuthGuard('jwt'))
  async(
    @Param('id', ParseIntPipe) id: number) {
    try {
      return this.documentoService.getInfoDocumentId(id);
    } catch (error) {}
  }


  //obtener todas las firmas pendientes de un usuario por el rut
  @Get('get-pending')
  @UseGuards(AuthGuard('jwt'))
  async getFirmasPendientePorFuncionario(
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    const user:User = req.user
    try {
      const result = await this.documentoService.getPendingSignatures(
        user.rut,
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


  //buscar todos los documentos por  usuario
  @Get('by-rut')
  @UseGuards(AuthGuard('jwt'))
  async getAllDocumentsByRut(
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    const user = req.user
    try {
      const result = await this.documentoService.getAllDocumentsByRut(
        user.rut,
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

  //realizar un soft delete en el documento en la base de datos 
  @Delete(':idDocument')
  @UseGuards(AuthGuard('jwt'))
  async deleteDocument(
    @Req() req,
    @Param('idDocument', ParseIntPipe) idDocument: number
  ) {
    const user = req.user
    try {
      return await this.documentoService.deleteDocument(user.rut, idDocument);
    } catch (error) {
      console.error('Error al eliminar el documento:', error);
      
      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      } else if (error instanceof BadRequestException) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      } else {
        throw new HttpException('No se pudo eliminar el documento', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }
}
