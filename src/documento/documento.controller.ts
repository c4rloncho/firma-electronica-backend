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
import { User } from 'src/interfaces/firma.interfaces';
import { Roles } from 'src/auth/roles.decorator';
import { Rol } from 'src/enums/rol.enum';
import { RolesGuard } from 'src/auth/roles.guard';
import { sign } from 'crypto';

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
    @Body('createDocumentDto') createDocumentDtoString: string, 
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {

      const createDocumentDto = JSON.parse(createDocumentDtoString)
      const creatorRut = req.user.rut;
      if (!file) {
        throw new HttpException(
          'No se ha proporcionado ningún archivo',
          HttpStatus.BAD_REQUEST,
        );
      }
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
      }
      throw error;
    }
  }

  //firmar un documento
  @Post('sign')
  @UseGuards(AuthGuard('jwt'))
  async signDocument(
    @Req() req,
    @Body() signDocumentDto: SignDocumentDto,
  ) {
    const rut = req.user.rut;
    console.log(signDocumentDto)
    try {
      const result = await this.documentoService.signDocument(
        rut,
        signDocumentDto,
      );
      return {
        message: 'Documento firmado exitosamente',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(`${error.message}`);
    }
  }

  //solo pueden ingresar usuarios con privilegios 'a' Administradores
  @Get('full-signed')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  async getFullySigned(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('name') name?: string,
  ) {
    try {
      return await this.documentoService.findFullySigned(
        page,
        limit,
        startDate,
        endDate,
        name,
      );
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
      await this.documentoService.getById(id, user, res, action);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      ) {
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
  async(@Param('id', ParseIntPipe) id: number) {
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
    const user: User = req.user;
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
    const user = req.user;
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
  @Get('created-by-me')
  @UseGuards(AuthGuard('jwt'))
  async getDocumentCreatedByMe(
    @Req() req,
    @Query('page', ParseIntPipe, new DefaultValuePipe(1)) page: number,
    @Query('limit', ParseIntPipe, new DefaultValuePipe(10)) limit: number,
    @Query('name') name?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const rut = req.user.rut;
    const result = await this.documentoService.getMyCreatedDocument(
      rut,
      page,
      limit,
      name,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return result;
  }

  //realizar un soft delete en el documento en la base de datos
  @Delete(':idDocument')
  @UseGuards(AuthGuard('jwt'))
  async deleteDocument(
    @Req() req,
    @Param('idDocument', ParseIntPipe) idDocument: number,
  ) {
    const user = req.user;
    try {
      return await this.documentoService.deleteDocument(user.rut, idDocument);
    } catch (error) {
      console.error('Error al eliminar el documento:', error);

      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      } else if (error instanceof BadRequestException) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      } else {
        throw new HttpException(
          'No se pudo eliminar el documento',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('/signed-documents/received')
  @UseGuards(AuthGuard('jwt'))
  async getReceivedDocuments(
    @Req() req,
    @Query('page', ParseIntPipe, new DefaultValuePipe(1)) page: number,
    @Query('limit', ParseIntPipe, new DefaultValuePipe(10)) limit: number,
    @Query('name') name?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { rut } = req.user;
    const result = await this.documentoService.getReceivedDocuments(
      rut,
      page,
      limit,
      name,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return result;
  }

  @Delete('/signed-document/received/:id')
  @UseGuards(AuthGuard('jwt'))
  async deleteReceivedDocument(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { rut } = req.user;
    return await this.documentoService.deleteReceivedDocuments(rut,id)
  }
}
