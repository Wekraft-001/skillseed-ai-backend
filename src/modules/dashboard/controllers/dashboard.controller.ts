import {
  Controller,
  Get,
  UseGuards,
  Post,
  Request,
  HttpStatus,
  HttpCode,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardData, UserRole } from 'src/common/interfaces';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards';
import { CurrentUser } from 'src/common/decorators';
import { LoggerService } from 'src/common/logger/logger.service';
import { User } from '../../schemas';
import { ApiResponseDto } from 'src/common/interfaces/api-response.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly logger: LoggerService,
  ) {}

  @Get('get-data')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiTags('Dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Get dashboard data',
    description:
      'Returns dashboard data based on user role(student, mentor, parent, shool_admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access, Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden access-User role not authorized for this operation',
  })
  @Roles(
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.MENTOR,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  async getDashboard(@CurrentUser() user: User) {
    this.logger.log(
      `Dashboard request from user: ${user._id} with role: ${user.role}`,
    );

    try {
      return await this.dashboardService.getDashboardData(user);
    } catch (error) {
      this.logger.error(
        `Error retrieving dashboard data for user: ${user._id}`,
        error,
      );
      throw error;
    }
  }

  @Get('students')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiTags('Dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SCHOOL_ADMIN, UserRole.PARENT)
  @ApiOperation({
    summary: 'Get students added by the logged-in school admin or parent',
    description:
      'Returns a list of students created by the logged-in user or belonging to their school',
  })
  @ApiResponse({
    status: 200,
    description: 'List of students retrieved successfully',
    type: [User],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getStudents(@CurrentUser() user: User) {
    try {
      this.logger.log(`Fetching students for user: ${user.email}`);

      return await this.dashboardService.getStudentsForUser(user);
    } catch (error) {
      this.logger.error(`Error fetching students for user: ${user._id}`, error);
      throw error;
    }
  }
}
