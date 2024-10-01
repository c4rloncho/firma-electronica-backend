import { DocumentSignature } from "src/documento/entities/document-signature.entity";
import { Entity, Column, PrimaryColumn, OneToMany, PrimaryGeneratedColumn } from "typeorm";
@Entity({ database: 'secondConnection' })
export class Delegate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  delegateRut: string;

  @Column()
  ownerRut: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isDeleted: boolean;

}
