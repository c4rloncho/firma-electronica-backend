import { Rol } from 'src/enums/rol.enum';
import { Entity, Column, PrimaryColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Document } from 'src/documento/entities/document.entity';
import { DocumentView } from 'src/documento/entities/document-visible-users.entity';

@Entity('funcionarios')
export class Funcionario {
  @PrimaryColumn({ type: 'varchar', length: 10 }) 
  rut: string;

  @Column({ type: 'varchar', length: 50, nullable: true }) 
  nombre: string;

  @Column({
    type: 'enum',
    enum: Rol,
    default: Rol.USER,
  })
  rol: Rol;

  @Column({nullable:true})
  activo: boolean;

  @Column({ type: 'varchar', length: 90, nullable: true }) 
  password: string;

  @Column({ type: 'varchar', length: 50, nullable: true })  
  cargo: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) 
  refreshToken?: string;

  @OneToMany(() => DocumentView, documentView => documentView.funcionario)
  documentViews:DocumentView[] ;
}