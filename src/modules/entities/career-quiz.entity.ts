import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from "typeorm";
import { User } from "./users/user.entity";

@Entity()
export class CareerQuiz {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, user => user.quizzes)
    user: User;

    @Column('json')
    questions: string[];

    @Column('simple-array', { nullable: true })
    answers: string[];

    @Column('json', { nullable: true })
    analysis: string;

    @Column({ default: false })
    completed: boolean;

    @CreateDateColumn()
    createdAt: Date;
}