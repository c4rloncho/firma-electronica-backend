import { Funcionario } from "src/funcionario/entities/funcionario.entity";
import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Document } from "./document.entity";

@Entity()
export class DocumentView{
    @PrimaryGeneratedColumn()
    id:number;

    @Column({default:false})
    isVisible: boolean;

    @ManyToOne(()=>Funcionario, funcionario =>funcionario.documentViews)
    funcionario:Funcionario;

    @ManyToOne(()=>Document,document => document.documentViews)
    document: Document;
}
