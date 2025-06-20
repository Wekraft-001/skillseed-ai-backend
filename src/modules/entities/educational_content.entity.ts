import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { User } from "./users/user.entity";

@Entity()
export class EducationalContent {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('json', { nullable: true })
    videoUrl: {title: string; url: string}[];

    @Column({type: 'jsonb', nullable: true})
    books: Array<{ title: string; author: string; level: string; theme: string }>;

    @Column({type: 'jsonb', nullable: true})
    games: Array<{
       name: string;
       url: string;
       skill: string;
    }>

    @Column({nullable: true})
    contentType: 'video' | 'book' | 'game';

    @ManyToOne(() => User, user => user.educationalContents)
    user: User;
}   