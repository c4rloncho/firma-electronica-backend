import { Document } from "src/documento/entities/document.entity";
import { Column, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class TypeDocument {

    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @OneToMany(()=> Document, document => document.typeDocument)
    documents: Document[]

    @DeleteDateColumn()
    deletedAt:Date;
}
