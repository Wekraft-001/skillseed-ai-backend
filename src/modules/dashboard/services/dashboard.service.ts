import { ForbiddenException, Injectable } from '@nestjs/common';
import { Badge, CareerQuiz, EducationalContent } from '../../entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProjectShowcase } from '../../entities/showcase.entity';
import { User } from '../../entities';
import { UserRole } from 'src/common/interfaces';
import { DashboardData } from 'src/common/interfaces';
import { DashboardSummary } from 'src/common/interfaces';
import { LoggerService } from 'src/common/logger/logger.service';
import { AiService } from '../../ai/ai.service';
import { School } from '../../entities/school.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(EducationalContent)
    private readonly eduContentRepo: Repository<EducationalContent>,
    @InjectRepository(Badge) private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(ProjectShowcase)
    private readonly projectShowcaseRepo: Repository<ProjectShowcase>,
    private readonly logger: LoggerService,
    private aiService: AiService,
    @InjectRepository(CareerQuiz)
    private readonly quizRepo: Repository<CareerQuiz>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async getDashboardData(user: User): Promise<{
    data: DashboardData;
    summary: DashboardSummary;
    role: UserRole;
  }> {
    try {
      this.logger.log(
        `Fetching dashboard data for user: ${user.id} with role: ${user.role}`,
      );

      let data: DashboardData = {};
      let summary: DashboardSummary = {};

      switch (user.role) {
        case UserRole.STUDENT:
          data = await this.getStudentDashboardData(user);
          summary = await this.getStudentSummary(user);
          break;
        case UserRole.MENTOR:
          data = await this.getMentorDashboardData(user);
          summary = await this.getMentorSummary(user);
          break;

        case UserRole.PARENT:
          data = await this.getParentDashboardData(user);
          summary = await this.getParentSummary(user);
          break;

        case UserRole.SCHOOL_ADMIN:
          data = await this.getSchoolAdminDashboardData(user);
          summary = await this.getSchoolAdminSummary(user);
          break;

        case UserRole.SUPER_ADMIN:
          data = await this.getSuperAdminDashboardData(user);
          summary = await this.getSuperAdminSummary(user);

        default:
          throw new ForbiddenException(
            'Invalid user role for dashboard access',
          );
      }

      return {
        data,
        summary,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching dashboard data for user: ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async getSuperAdminDashboardData(user: User): Promise <DashboardData> {
    try {
      const [schools, students] = await Promise.all([
        this.schoolRepo.find({
          relations: ['users']
        }),
        this.userRepo.find({
          where: { role: UserRole.STUDENT},
        })
      ]);

      return {
        schools,
        students
      };
      
    } catch (error) {
      this.logger.error(`Error fetching super admin dashboard data for user: ${user.id}`, error);
      throw error;
    }
  }



  private async getSuperAdminSummary(user: User): Promise<DashboardSummary> {
    try {

    const [schoolCount, userCount] = await Promise.all([
      this.schoolRepo.count(),
      this.userRepo.count(),
    ]);
    return {
      totalSchools: schoolCount,
      totalUsers: userCount
    }
      
    } catch (error) {
      this.logger.error(`Error fetching super admin summary for user: ${user.id}`, error);
      throw error;
    }
  }

  private async getStudentDashboardData(user: User): Promise<DashboardData> {
    try {
      const [educationalContents, badges] = await Promise.all([
        this.getEducationalContents(user),
        this.getStudentsBadges(user),
      ]);

      return {
        educationalContents,
        badges,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching student dashboard data for user: ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async getEducationalContents(
    user: User,
  ): Promise<EducationalContent[]> {
    try {
      let content = await this.eduContentRepo.find({
        where: { user: { id: user.id } },
        // order: { createdAt: 'DESC' },
      });

      if (!content.length) {
        this.logger.log(
          `No educational content found for user: ${user.id}. Generating.. please wait...`,
        );
        const newContent = await this.aiService.generateEducationalContent(
          user.id,
        );
        content = [newContent];
      }

      return content;
    } catch (error) {
      this.logger.error(
        `Error fetching educational content for user: ${user.id}`,
        error,
      );
      throw error;
    }
  }

  private async getStudentsBadges(user: User): Promise<Badge[]> {
    return this.badgeRepo.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'DESC' },
    });
  }

  private async getStudentSummary(user: User): Promise<DashboardSummary> {
    const [badgeCount, completedQuizzes] = await Promise.all([
      this.badgeRepo.count({ where: { user: { id: user.id } } }),
      this.getCompletedQuizzesCount(user),
    ]);

    return {
      totalBadges: badgeCount,
      completedQuizzes: completedQuizzes,
    };
  }

  private async getMentorDashboardData(user: User): Promise<DashboardData> {
    const [students, badges, showcases] = await Promise.all([
      this.getMentoredStudents(user),
      this.getBadges(user),
      this.getProjectShowcases(user),
      // this.getMentorAnalytics(user),
    ]);

    return {
      students,
      badges,
      showcases,
      // recentActivities: await this.getRecentActivities(user),
      // notifications: await this.getMentorNotifications(user),
    };
  }

  private async getMentorSummary(user: User): Promise<DashboardSummary> {
    const [studentCount, badgeCount, showcaseCount] = await Promise.all([
      this.getMentoredStudentsCount(user),
      this.badgeRepo.count({ where: { user: { id: user.id } } }),
      this.projectShowcaseRepo.count({ where: { user: { id: user.id } } }),
    ]);

    return {
      totalStudents: studentCount,
      totalBadges: badgeCount,
      totalShowcases: showcaseCount,
      // recentActivities: await this.getRecentActivityCount(user),
    };
  }

  private async getParentDashboardData(user: User): Promise<DashboardData> {
    const [children, badges, showcases] = await Promise.all([
      this.getChildren(user),
      this.getBadges(user),
      this.getProjectShowcases(user),
    ]);

    return {
      students: children,
      badges,
      showcases,
      // recentActivities: await this.getChildrenActivity(user),
      // notifications: await this.getParentNotifications(user),
    };
  }

  private async getParentSummary(user: User): Promise<DashboardSummary> {
    const [childrenCount, badgeCount, showcaseCount] = await Promise.all([
      this.getChildrenCount(user),
      this.getChildrenBadgesCount(user),
      this.getChildrenShowcasesCount(user),
    ]);

    return {
      totalStudents: childrenCount,
      totalBadges: badgeCount,
      totalShowcases: showcaseCount,
      // recentActivities: await this.getChildrenActivityCount(user),
    };
  }

  private async getSchoolAdminDashboardData(
    user: User,
  ): Promise<DashboardData> {
    const [students, analytics, showcases, schools] = await Promise.all([
      this.getSchoolStudents(user),
      this.getSchoolAnalytics(user),
      this.getSchoolShowcases(user),
      this.schoolRepo.find({
        where: { admin: { id: user.id}},
        relations: ['admin']
      })
    ]);

    return {
      students,
      analytics,
      showcases,
      schools,
      // recentActivities: await this.getRecentActivities(user),
      // notifications: await this.getSchoolNotifications(user),
    };
  }

  private async getSchoolAdminSummary(user: User): Promise<DashboardSummary> {
    const [studentCount, badgeCount, showcaseCount] = await Promise.all([
      this.getSchoolStudentsCount(user),
      this.getSchoolBadgesCount(user),
      this.getSchoolShowcasesCount(user),
    ]);

    return {
      totalStudents: studentCount,
      totalBadges: badgeCount,
      totalShowcases: showcaseCount,
      // recentActivities: await this.getSchoolActivityCount(user),
    };
  }

  private async getProjectShowcases(user: User): Promise<ProjectShowcase[]> {
    if (
      user.role === UserRole.MENTOR ||
      user.role === UserRole.SCHOOL_ADMIN ||
      user.role === UserRole.PARENT
    ) {
      return this.projectShowcaseRepo.find({
        where: { user: { id: user.id } },
      });
    }
  }

  private async getCompletedQuizzesCount(user: User): Promise<number> {
    return this.quizRepo.count({
      where: { user: { id: user.id}, completed: true}
    })
  }

  private async getChildren(user: User): Promise<User[]> {
    return [];
  }

  private async getChildrenCount(user: User): Promise<any> {}

  private async getMentoredStudents(user: User): Promise<User[]> {
    return [];
  }

  private async getMentoredStudentsCount(user: User): Promise<any> {
    return 0;
  }
  private async getBadges(user: User): Promise<Badge[]> {
    return [];
  }
  private async getSchoolStudents(user: User): Promise<User[]> {
    return [];
  }
  private async getSchoolStudentsCount(user: User): Promise<any> {
    return 0;
  }
  private async getSchoolAnalytics(user: User): Promise<any> {
    return {};
  }
  private async getSchoolShowcases(user: User): Promise<ProjectShowcase[]> {
    return [];
  }
  private async getSchoolBadgesCount(user: User): Promise<any> {
    return 0;
  }
  private async getSchoolShowcasesCount(user: User): Promise<any> {
    return 0;
  }
  private async getChildrenBadgesCount(user: User): Promise<any> {
    return 0;
  }
  private async getChildrenShowcasesCount(user: User): Promise<any> {
    return 0; }
}
