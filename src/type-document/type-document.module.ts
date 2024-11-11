import { Module } from '@nestjs/common';
import { TypeDocumentService } from './type-document.service';
import { TypeDocumentController } from './type-document.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeDocument } from './entities/type-document.entity';

@Module({
  imports:[TypeOrmModule.forFeature([TypeDocument])],
  controllers: [TypeDocumentController],
  providers: [TypeDocumentService],
})
export class TypeDocumentModule {}
