import { Module } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { DocumentoController } from './documento.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';

@Module({
  imports:[TypeOrmModule.forFeature([Document,DocumentSignature])],
  controllers: [DocumentoController],
  providers: [DocumentoService],
  exports:[DocumentoService]
})
export class DocumentoModule {}
