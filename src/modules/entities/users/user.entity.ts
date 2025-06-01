import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { UserRole } from "src/common/interfaces";
import { CareerQuiz } from "../career-quiz.entity";
import { Badge } from "../badges.entity";
import { EducationalContent } from "../educational_content.entity";
import { ProjectShowcase } from "../showcase.entity";

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

    @OneToMany(() => CareerQuiz, quizzes => quizzes.user)
    quizzes: CareerQuiz

    @OneToMany(() => Badge, badges => badges.user)
    badges: Badge[];

    @OneToMany(() => EducationalContent, educationalContents => educationalContents.user)
    educationalContents: EducationalContent[];

    @OneToMany(() => ProjectShowcase, showcases => showcases.user)
    showcases: ProjectShowcase[];

    @Column({nullable: true})
    age: number;

    @Column({unique: true})
    email: string;

    @Column()
    password: string;
}