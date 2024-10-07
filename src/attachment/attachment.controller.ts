import { Controller, Post, UseInterceptors, UploadedFile, Body, BadRequestException, Get, Param, ParseIntPipe, InternalServerErrorException, NotFoundException, Res, UseGuards, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AttachmentService } from './attachment.service';
import { Attachment } from './entities/attachment .entity';
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
  async uploadFile(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() createAttachmentDto: CreateAttachmentDto
  ) {
    const user = req.user;
    try {
      return this.attachmentService.addAttachment(file,createAttachmentDto,user.rut)
    } catch (error) {
      
    }
  }
  @Get('document/:id')
  @UseGuards(AuthGuard('jwt'))
  async getAttachmentsByDocument(@Param('id', ParseIntPipe) id: number): Promise<Attachment[]> {
    try {
      return await this.attachmentService.getAttachments(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener los anexos del documento');
    }
  }

  @Get(':id')
  async getAttachment(@Param('id', ParseIntPipe) id: number,@Res() res:Response) {
    try {
      const attachment =  await this.attachmentService.getAttachment(id);
      const filePath = join(process.cwd(), attachment.filePath);

      // Verificar si el archivo existe
      if (!existsSync(filePath)) {
        throw new NotFoundException(
          `El archivo ${attachment.fileName} no se encuentra en el servidor.`,
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${attachment.fileName}"`,
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
}