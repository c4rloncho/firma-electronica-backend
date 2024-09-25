import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from './document.entity';

export enum SignerType {
  VISADOR = "visador",
  FIRMADOR = "firmador"
}

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

  @Column({
    type: "enum",
    enum: SignerType,
    default: SignerType.FIRMADOR
  })
  signerType: SignerType;

  @Column({ nullable: true })
  signedAt: Date;

  @Column({ default: false })
  isSigned: boolean;
}