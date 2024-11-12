  import { Column, DeleteDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
  import { DocumentSignature } from "./document-signature.entity";
  import { Attachment } from "../../attachment/entities/attachment.entity";
  import { TypeDocument } from "src/type-document/entities/type-document.entity";
  import { Funcionario } from "src/funcionario/entities/funcionario.entity";
import { DocumentView } from "./document-visible-users.entity";

  @Entity()
  export class Document {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    fileName: string;

    @Column({nullable:true, type: 'timestamp' })
    date: Date;

    @DeleteDateColumn()
    deletedAt: Date;
    
    @Column({nullable:true})
    creatorRut:string;

    @OneToMany(() => DocumentSignature, signature => signature.document)
    signatures: DocumentSignature[];

    @Column({ default: false })
    isFullySigned: boolean;

    @OneToMany(() => Attachment, attachment => attachment.document)
    attachments: Attachment[];

    @ManyToOne(()=> TypeDocument, typedocument => typedocument.documents)
    typeDocument:TypeDocument;

    @OneToMany(()=>DocumentView, documentView => documentView.document)
    documentViews: DocumentView[];


  }
