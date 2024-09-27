import { Entity, Column, PrimaryColumn } from "typeorm";

@Entity({ database: 'secondConnection' })
export class Delegate {
    @PrimaryColumn()
    delegateRut: string;

    @PrimaryColumn()
    ownerRut: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ nullable: true, type: 'timestamp' })
    expiresAt: Date;
}