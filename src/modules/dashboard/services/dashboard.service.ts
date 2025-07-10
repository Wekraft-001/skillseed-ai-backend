import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoggerService } from 'src/common/logger/logger.service';
import { AiService } from '../../ai/ai.service';
import {
  DashboardData,
  DashboardResponse,
  DashboardSummary,
  UserRole,
} from 'src/common/interfaces';

import { EducationalContent } from '../../schemas/educational_content.schema';
import { Badge, User } from '../../schemas';
import { ProjectShowcase } from '../../schemas/showcase.schema';
import { CareerQuiz } from '../../schemas/career-quiz.schema';
import { School } from '../../schemas/school.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(EducationalContent.name)
    private readonly eduContentModel: Model<EducationalContent>,

    @InjectModel(Badge.name)
    private readonly badgeModel: Model<Badge>,

    @InjectModel(ProjectShowcase.name)
    private readonly projectShowcaseModel: Model<ProjectShowcase>,

    @InjectModel(CareerQuiz.name)
    private readonly quizModel: Model<CareerQuiz>,

    @InjectModel(School.name)
    private readonly schoolModel: Model<School>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly logger: LoggerService,
    private readonly aiService: AiService,
  ) {}

  async getDashboardData(user: User): Promise<{
    dashboardResponse: DashboardResponse;
    summary: DashboardSummary;
    currentUser: User;
  }> {
    try {
      this.logger.log(
        `Fetching dashboard data for user: ${user._id} with role: ${user.role}`,
      );

      const [data, summary] = await (() => {
        switch (user.role) {
          case UserRole.STUDENT:
            return Promise.all([
              this.getStudentDashboardData(user),
              this.getStudentSummary(user),
            ]);
          case UserRole.MENTOR:
            return Promise.all([
              this.getMentorDashboardData(user),
              this.getMentorSummary(user),
            ]);
          case UserRole.PARENT:
            return Promise.all([
              this.getParentDashboardData(user),
              this.getParentSummary(user),
            ]);
          case UserRole.SCHOOL_ADMIN:
            return Promise.all([
              this.getSchoolAdminDashboardData(user),
              this.getSchoolAdminSummary(user),
            ]);
          case UserRole.SUPER_ADMIN:
            return Promise.all([
              this.getSuperAdminDashboardData(user),
              this.getSuperAdminSummary(user),
            ]);
          default:
            throw new ForbiddenException('Invalid user role');
        }
      })();

      const dashboardResponse: DashboardResponse = {
        ...data,
        success: true,
        message: 'Dashboard data retrieved successfully',
        timestamp: new Date().toISOString(),
        userId: (user as any)._id,
        summary,
        currentUser: user
      };

      return {
        dashboardResponse,
        summary,
        currentUser: user,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching dashboard data for user: ${user._id}`,
        error,
      );
      throw error;
    }
  }

  private async getSuperAdminDashboardData(user: User): Promise<DashboardData> {
    const [schools, students] = await Promise.all([
      this.schoolModel
        .find({ deletedAt: null })
        .populate('superAdmin', 'firstName lastName email role')
        .populate('createdBy', 'firstName lastName email role')
        .lean(),
      this.userModel
        .find({
          role: UserRole.STUDENT,
          deletedAt: null,
        })
        .populate('school', 'schoolName email logoUrl')
        .populate('createdBy', 'firstName lastName email role')
        .lean(),
    ]);

    return {
      schools,
      students,
      analytics: {
        totalSchools: schools.length,
        totalStudents: students.length,
      },
    };
  }

  private async getSuperAdminSummary(user: User): Promise<DashboardSummary> {
    const schoolCount = await this.schoolModel.countDocuments();
    const userCount = await this.userModel.countDocuments();
    return {
      totalSchools: schoolCount,
      totalUsers: userCount,
      // user: user as any,
    };
  }

  private async getStudentDashboardData(user: User): Promise<DashboardData> {
    const [educationalContents, badges] = await Promise.all([
      this.getEducationalContents(user),
      this.getStudentsBadges(user),
    ]);

    return {
      educationalContents,
      badges,
    };
  }

  private async getEducationalContents(
    user: User,
  ): Promise<EducationalContent[]> {
    let content = await this.eduContentModel.find({ user: user._id });

    if (!content.length) {
      this.logger.log(
        `No educational content found for user: ${user._id.toString()}. Generating.. please wait...`,
      );

      // Generate the content data
      const newContentData = await this.aiService.generateEducationalContent(
        user._id.toString(), // Convert ObjectId to string for the AI service
      );

      // Create and save the document using the model
      const newContent = await this.eduContentModel.create({
        ...newContentData,
        user: user._id,
      });

      content = [newContent];
    }

    return content;
  }

  private async getStudentsBadges(user: User): Promise<Badge[]> {
    return this.badgeModel.find({ user: user._id }).sort({ createdAt: -1 });
  }

  private async getStudentSummary(user: User): Promise<DashboardSummary> {
    const [badgeCount, completedQuizzes] = await Promise.all([
      this.badgeModel.countDocuments({ user: user._id }),
      this.quizModel.countDocuments({ user: user._id, completed: true }),
    ]);
    return {
      totalBadges: badgeCount,
      completedQuizzes,
    };
  }

  private async getMentorDashboardData(user: User): Promise<DashboardData> {
    return {
      // success: true,
      // message: 'Mentor dashboard data retrieved successfully',
      // timestamp: new Date().toISOString(),
      // userId: (user as any)._id,
      students: [],
      badges: [],
      showcases: [],
    };
  }

  private async getMentorSummary(user: User): Promise<DashboardSummary> {
    return {
      totalStudents: 0,
      totalBadges: await this.badgeModel.countDocuments({ user: user._id }),
      totalShowcases: await this.projectShowcaseModel.countDocuments({
        user: user._id,
      }),
    };
  }

  private async getParentDashboardData(user: User): Promise<DashboardData> {
    return {
      // success: true,
      // message: 'Parent dashboard data retrieved successfully',
      // timestamp: new Date().toISOString(),
      // userId: (user as any)._id,
      students: [],
      badges: [],
      showcases: [],
    };
  }

  private async getParentSummary(user: User): Promise<DashboardSummary> {
    return {
      totalStudents: 0,
      totalBadges: 0,
      totalShowcases: 0,
    };
  }

  private async getSchoolAdminDashboardData(
    user: User,
  ): Promise<DashboardData> {
    const [students] = await Promise.all([
      this.userModel
        .find({
          role: UserRole.STUDENT,
          createdBy: user._id,
          deletedAt: null,
        })
        .populate('school', 'schoolName schoolContactPerson email logoUrl')
        .populate('createdBy', 'firstName lastName email role')
        .populate('quizzes')
        .lean(),
    ]);

    return {
      students,
      showcases: [],
      analytics: {
      totalStudents: students.length,
    },
    };
  }

  private async getSchoolAdminSummary(user: User): Promise<DashboardSummary> {
    return {
      totalStudents: 0,
      totalBadges: 0,
      totalShowcases: 0,
    };
  }
}
