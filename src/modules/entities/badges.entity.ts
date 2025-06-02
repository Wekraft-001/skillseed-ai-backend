import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne } from "typeorm";
import { User } from "./users/user.entity";
import { ProjectShowcase } from "./showcase.entity";

@Entity()
export class Badge {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column({ nullable: true })
    imageUrl: string;

    @Column({type: 'jsonb'})
    tasks: Array<{
        description: string;
        isCompleted: boolean;
    }>;

    @Column({ type: 'boolean', default: false })
    isCompleted: boolean;

    @OneToOne(() => ProjectShowcase, showcase => showcase.badge)
    showcase: ProjectShowcase;


    @ManyToOne(() => User, user => user.badges)
    user: User;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}