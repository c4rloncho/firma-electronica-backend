import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Document } from '../../documento/entities/document.entity';

@Entity({ database: 'secondConnection' })
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  fileName: string;

  @ManyToOne(() => Document, document => document.attachments)
  document: Document;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadDate: Date;


}