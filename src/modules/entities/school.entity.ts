import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn, ManyToOne, DeleteDateColumn } from "typeorm"
import { User } from "./users/user.entity";

@Entity()
export class School {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    schoolName: string;

    @Column()
    email: string;

    @Column()
    address: string;

    @Column({nullable: true})
    logoUrl: string;

    @Column()
    phoneNumber: number;

    @OneToMany(() => User, user => user.school, { cascade: true })
    users: User[];

    @OneToOne(() => User)
    @JoinColumn()
    admin: User;

    @ManyToOne(() => User)
    superAdmin: User;

    // @Column({ nullable: true })
    // superAdminId: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updateAt: Date;

    @DeleteDateColumn({nullable: true})
    deletedAt: Date;

}