import { Module } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { DocumentoController } from './documento.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';
import { FirmaModule } from 'src/firma/firma.module';

@Module({
  imports:[TypeOrmModule.forFeature([Document,DocumentSignature]),FirmaModule],
  controllers: [DocumentoController],
  providers: [DocumentoService],
  exports:[DocumentoService]
})
export class DocumentoModule {}
