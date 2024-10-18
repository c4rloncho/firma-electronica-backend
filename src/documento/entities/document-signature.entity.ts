import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from './document.entity';
import { SignerType } from "src/enums/signer-type.enum";



@Entity({ database: 'secondConnection' })
export class DocumentSignature {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Document, document => document.signatures)
  document: Document;

  @Column()
  signerOrder: number;

  @Column()
  ownerRut: string;

  @Column({ nullable: true })
  signerRut: string;

  // @ManyToOne(() => Delegate, { nullable: true })
  // delegate: Delegate;

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