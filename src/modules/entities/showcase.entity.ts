import { Entity, PrimaryGeneratedColumn, Column, OneToOne, ManyToOne } from "typeorm";
import { Badge } from "./badges.entity";
import { User } from "./users/user.entity";
import { UserRole } from "src/common/interfaces";

@Entity()
export class ProjectShowcase {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    projectName: string;

    @Column()
    description: string;
    

    @OneToOne(() => Badge, badge => badge.showcase)
    badge: Badge;

    @ManyToOne(() => User, user => user.showcases)
    user: User;

    @Column({ type: 'jsonb', nullable: true })
    feeback: Array<{
        userId: number;
        role: UserRole;
        comment: string;
        timestamp: Date;
    }>

    @Column()
    imageUrl: string;
}