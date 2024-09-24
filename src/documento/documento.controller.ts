import { Body, Controller, Post } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { SignDocumentDto } from './dto/sign-document.dto';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documento')
export class DocumentoController {
  constructor(private readonly documentoService: DocumentoService) {}

  @Post('create')
  async createDocument(@Body()input:CreateDocumentDto){
    try {
      return this.documentoService.createDocument(input);
    } catch (error) {
      
    }
  }

}
