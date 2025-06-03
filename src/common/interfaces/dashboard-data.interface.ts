import { Badge, EducationalContent, User } from "src/modules/entities";
import { ProjectShowcase } from "src/modules/entities/showcase.entity";

export interface DashboardData {
    educationalContents?: EducationalContent[];
    badges?: Badge[];
    showcases?: ProjectShowcase[];
    students?: User[];
    mentors?: User[];
    parents?: User[];
    analytics?: any;
    // recentActivities?: any[];
    // notifications?: any[];
}

export interface DashboardSummary {
    totalStudents?: number;
    totalBadges?: number;
    totalShowcases?: number;
    completedQuizzes?: number;
    recentActivities?: number;
}