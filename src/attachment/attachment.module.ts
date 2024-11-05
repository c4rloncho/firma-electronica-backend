import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attachment } from './entities/attachment.entity';
import { Document } from 'src/documento/entities/document.entity';
import { DocumentoModule } from 'src/documento/documento.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attachment, Document], 'secondConnection'),
    DocumentoModule,
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
