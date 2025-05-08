import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { UserRole } from "src/common/interfaces";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.STUDENT,
    })
    role: UserRole;

    @Column({unique: true})
    email: string;

    @Column()
    password: string;
}