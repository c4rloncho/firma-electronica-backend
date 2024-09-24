import { Injectable } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { DocumentSignature } from './entities/document-signature.entity';
import { SignerDto } from './dto/signer.dto';
import { SignDocumentDto } from './dto/sign-document.dto';

@Injectable()
export class DocumentoService {

    constructor(
        @InjectRepository(Document)
        private readonly documentRepository:Repository<Document>,
        @InjectRepository(DocumentSignature)
        private readonly documentSignatureRepository:Repository<DocumentSignature>,
    ){}


    async createDocument(createDocumentDto: CreateDocumentDto): Promise<Document> {
        const { name, filePath, signers } = createDocumentDto;
    
        const document = this.documentRepository.create({ name, filePath });
        await this.documentRepository.save(document);
    
        const signatures = signers.map((signer: SignerDto) =>
          this.documentSignatureRepository.create({
            document,
            signerRut: signer.rut,
            signerOrder: signer.order,
          })
        );
        await this.documentSignatureRepository.save(signatures);
        return document;
    }

    async signDocument(input:SignDocumentDto){
        const {documentId,rut} = input
        const document = this.documentRepository.findOne({where:{id:documentId}});
        
    }
}
