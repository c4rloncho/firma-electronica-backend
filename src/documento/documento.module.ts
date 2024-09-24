import { Module } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { DocumentoController } from './documento.controller';

@Module({
  controllers: [DocumentoController],
  providers: [DocumentoService],
})
export class DocumentoModule {}
