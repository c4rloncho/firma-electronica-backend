import { Module } from '@nestjs/common';
import { DocumentoService } from './documento.service';
import { DocumentoController } from './documento.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';
import { FirmaModule } from 'src/firma/firma.module';
import { Attachment } from '../attachment/entities/attachment.entity';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { Delegate } from 'src/delegate/entities/delegado.entity';
import { RemoteStorageService } from './sftp-storage-service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Document, DocumentSignature, Attachment,Delegate],
      'secondConnection',
    ),
    TypeOrmModule.forFeature([Funcionario],'default'),
    FirmaModule,
  ],
  controllers: [DocumentoController],
  providers: [DocumentoService,RemoteStorageService],
  exports: [DocumentoService,RemoteStorageService],
})
export class DocumentoModule {}
