import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Get,
  Param,
  ParseIntPipe,
  InternalServerErrorException,
  NotFoundException,
  Res,
  UseGuards,
  Req,
  Delete,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AttachmentService } from './attachment.service';
import { Attachment } from './entities/attachment.entity';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
@Controller('attachment')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  //creador del documento solo el puede subir anexos
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED) 
  async uploadFile(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() createAttachmentDto: CreateAttachmentDto,
  ) {
    const user = req.user;
    try {
      return this.attachmentService.addAttachment(
        file,
        createAttachmentDto,
        user.rut,
      );
    } catch (error) {}
  }
  @Get('by-document/:id')
  @UseGuards(AuthGuard('jwt'))
  async getAttachmentsByDocument(
    @Param('id', ParseIntPipe) id: number,
  ):Promise<{
    id:number,
    name:string,
    createdAt:Date,

  }[]>{
    try {
      return await this.attachmentService.getAttachments(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener los anexos del documento',
      );
    }
  }
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK) 
  async deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,  
  ) {
    try {
      const user = req.user;
      return await this.attachmentService.deleteAttachment(user.rut, id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      }
      throw new InternalServerErrorException('Error al eliminar el anexo');
    }
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getAttachment(
    @Req() req,
    @Query('action') action: 'view' | 'download',
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    try {
      await this.attachmentService.getById(id, res, action);

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
}
