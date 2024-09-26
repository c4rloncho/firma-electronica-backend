import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from '../../documento/entities/document.entity';

@Entity()
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  fileName: string;

  @ManyToOne(() => Document, document => document.attachments)
  document: Document;

  @Column()
  uploadDate: Date;

}