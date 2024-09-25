import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { DocumentSignature } from "./document-signature.entity";

@Entity()
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  fileName: string;

  @OneToMany(() => DocumentSignature, signature => signature.document)
  signatures: DocumentSignature[];

  @Column({ default: false })
  isFullySigned: boolean;
}
