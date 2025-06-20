import { Badge, EducationalContent, User } from "src/modules/entities";
import { ProjectShowcase } from "src/modules/entities/showcase.entity";
import { School } from "src/modules/entities/school.entity";

export interface DashboardData {
    educationalContents?: EducationalContent[];
    badges?: Badge[];
    showcases?: ProjectShowcase[];
    students?: User[];
    mentors?: User[];
    parents?: User[];
    analytics?: any;
    schools?: School[];
    success: boolean;
    message?: string;
    timestamp?: string;
    data?: any;
    userId: number;
    // recentActivities?: any[];
    // notifications?: any[];
}

export interface DashboardSummary {
    totalStudents?: number;
    totalBadges?: number;
    totalSchools?: number;
    totalUsers?: number;
    totalShowcases?: number;
    completedQuizzes?: number;
    recentActivities?: number;
}