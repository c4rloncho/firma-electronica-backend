import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from './document.entity';

@Entity()
export class DocumentSignature {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Document, document => document.signatures)
  document: Document;

  @Column()
  signerOrder: number;

  @Column()
  signerRut: string;

  @Column({ nullable: true })
  signedAt: Date;

  @Column({ default: false })
  isSigned: boolean;
}