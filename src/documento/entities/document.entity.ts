import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { DocumentSignature } from "./document-signature.entity";
import { Attachment } from "../../attachment/entities/attachment .entity";

@Entity({database:'secondConnection'})
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  fileName: string;

  @Column({ type: 'date' })
  date: Date;

  @OneToMany(() => DocumentSignature, signature => signature.document)
  signatures: DocumentSignature[];

  @Column({ default: false })
  isFullySigned: boolean;

  @OneToMany(() => Attachment, attachment => attachment.document)
  attachments: Attachment[];

}
