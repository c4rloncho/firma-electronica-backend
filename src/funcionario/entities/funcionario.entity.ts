import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('funcionarios', { database: 'default' })
export class Funcionario {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  rut: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nombre: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  iniciales: string;

  @Column({ type: 'int' })
  activo: number;

  @Column({ type: 'varchar', length: 90, nullable: true })
  password: string;

  @Column({ type: 'int', nullable: true })
  pass_temp: number;

  @Column({ type: 'char', length: 1, nullable: true })
  Privilegio: string;

  @Column({ type: 'char', length: 1, nullable: true })
  Municipal: string;

  @Column({ type: 'char', length: 1, nullable: true })
  Salud: string;

  @Column({ type: 'char', length: 1, nullable: true })
  Educacion: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  iddigital: string;

  @Column({ type: 'int', nullable: true })
  cert_iddigital: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  resp_iddigital: string;

  @Column({ type: 'int', nullable: true })
  Depto: number;

  @Column({ type: 'int', nullable: true })
  seccion: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cargo: string;

  @Column({ type: 'int', nullable: true })
  coddepto2: number;

  @Column({ type: 'int', nullable: true })
  codseccion2: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gastosmenores: string;

  @Column({ type: 'varchar', length: 90, nullable: true })
  correo: string;

  @Column({ type: 'int', nullable: true })
  Movilizacion: number;

  @Column({ type: 'int', nullable: true })
  cheques: number;

  @Column({ type: 'int', nullable: true })
  addproductos: number;

  @Column({ type: 'int', nullable: true })
  compramateriales: number;

  @Column({ type: 'int', nullable: true })
  compraglobal: number;

  @Column({ type: 'int', nullable: true })
  Addfirmantes: number;

  @Column({ type: 'int', nullable: true })
  adminpedidos: number;

  @Column({ type: 'int', nullable: true })
  bodega: number;

  @Column({ type: 'int', nullable: true })
  org: number;

  @Column({ type: 'int', nullable: true })
  tarjetaacceso: number;

  @Column({ type: 'int', nullable: true })
  bloqueo_decretos: number;

  @Column({ type: 'int', nullable: true })
  vistos_Decretos: number;

  @Column({ type: 'int', nullable: true })
  digitalizar_Decretos: number;

  @Column({ type: 'int', nullable: true })
  dec_adm: number;

  @Column({ type: 'int', nullable: true })
  dec_jur: number;

  @Column({ type: 'int', nullable: true })
  dec_con: number;

  @Column({ type: 'int', nullable: true })
  Fotocopiadora: number;

  @Column({ type: 'int', nullable: true })
  digitalizacion: number;

  @Column({ type: 'int', nullable: true })
  almacen: number;

  @Column({ type: 'int', nullable: true })
  vb_asistente_dir: number;

  @Column({ type: 'int', nullable: true })
  vb_asistente_sec: number;

  @Column({ type: 'int', nullable: true })
  superv_dem: number;

  @Column({ type: 'int', nullable: true })
  ver_liquid: number;

  @Column({ type: 'int', nullable: true })
  plantillasdec: number;

  @Column({ type: 'int', nullable: true })
  certificados: number;

  @Column({ type: 'int', nullable: true })
  activa_firmantes: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  plantillasdepto: string;

  @Column({ nullable: true })
  refreshToken?: string;
}