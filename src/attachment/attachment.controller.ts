import { Controller, Post, UseInterceptors, UploadedFile, Body, BadRequestException, Get, Param, ParseIntPipe, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { AttachmentService } from './attachment.service';
import { Attachment } from './entities/attachment .entity';

@Controller('attachment')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() createAttachmentDto: CreateAttachmentDto
  ) {
    try {
      return this.attachmentService.addAttachment(file,createAttachmentDto)
    } catch (error) {
      
    }
  }
  @Get('document/:id')
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
  async getAttachment(@Param('id', ParseIntPipe) id: number): Promise<Attachment> {
    try {
      return await this.attachmentService.getAttachment(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener el anexo');
    }
  }
}