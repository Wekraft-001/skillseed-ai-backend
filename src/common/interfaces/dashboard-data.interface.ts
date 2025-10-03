import { Badge, CareerQuiz, EducationalContent, User } from "src/modules/schemas";
import { ProjectShowcase } from "src/modules/schemas/showcase.schema";
import { School } from "src/modules/dashboard/school_admin/schema/school.schema";

export interface DashboardData {
    educationalContents?: EducationalContent[];
    badges?: Badge[];
    showcases?: ProjectShowcase[];
    student?: User[];
    mentors?: User[];
    parents?: User[];
    analytics?: any;
    schools?: School[];
}

export interface DashboardResponse extends DashboardData {
    students?: User[],
    mentors?: User[],
    schools?: School[],
    success: boolean,
    message: string,
    timestamp: string,
    userId: string,
    summary?: DashboardSummary,
    currentUser: User,
    quizStatus?: {
        hasQuiz: boolean;
        isCompleted: boolean;
        needsToTakeQuiz: boolean;
    },
    stars?: any[], // Adding stars field to the response
    // data?: {
    //     success: true,
    //     message: 'Dashboard data retrieved successfully',        
    // };
}

export interface SuperAdminDashboardResponse {

}

export interface DashboardSummary {
    totalStudent?: number;
    totalBadges?: number;
    totalSchools?: number;
    totalUsers?: number;
    totalShowcases?: number;
    completedQuizzes?: number;
    recentActivities?: number;
    // user: User[]
}