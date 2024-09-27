import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from './document.entity';

export enum SignerType {
  VISADOR = "visador",
  FIRMADOR = "firmador"
}
export enum DelegationType{
  DELEGADO = "delegado",
  TITULAR = "titular"
}

@Entity({ database: 'secondConnection' })
@Index(["document", "signerOrder"], { unique: true })
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
  delegateRut: string;

  @Column({
    type: "enum",
    enum: DelegationType,
    default: DelegationType.TITULAR
  })
  delegationType: DelegationType;

  @Column({
    type: "enum",
    enum: SignerType,
    default: SignerType.FIRMADOR
  })
  signerType: SignerType;

  @Column({ nullable: true, type: 'timestamp' })
  signedAt: Date;

  @Column({ default: false })
  isSigned: boolean;
}