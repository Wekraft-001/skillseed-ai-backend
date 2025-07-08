import { Badge, EducationalContent, User } from "src/modules/schemas";
import { ProjectShowcase } from "src/modules/schemas/showcase.schema";
import { School } from "src/modules/schemas/school.schema";

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

export interface SuperAdminDashboardResponse {

}

export interface DashboardSummary {
    totalStudents?: number;
    totalBadges?: number;
    totalSchools?: number;
    totalUsers?: number;
    totalShowcases?: number;
    completedQuizzes?: number;
    recentActivities?: number;
    // user: User[]
}