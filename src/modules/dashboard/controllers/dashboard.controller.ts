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
import { UserRole } from 'src/common/interfaces';
import { DashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from '../../auth/guards';
import { CurrentUser } from 'src/common/decorators';
import { LoggerService } from 'src/common/logger/logger.service';
import { User } from '../../entities';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly logger: LoggerService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get dashboard data',
    description:
      'Returns dashboard data based on user role(student, mentor, parent, shool_admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          description: 'Role-specific dashboard data',
        },
        summary: {
          type: 'object',
          description: 'Summary statistics',
        },
        role: {
          type: 'string',
          enum: [
            UserRole.STUDENT,
            UserRole.PARENT,
            UserRole.MENTOR,
            UserRole.SCHOOL_ADMIN,
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden access',
  })
  @Roles(
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.MENTOR,
    UserRole.SCHOOL_ADMIN,
  )
  async getDashboard(@CurrentUser() user: User) {
    this.logger.log(`Dashboard request from user: ${user.id} with role: ${user.role}`);

    try {
        const dashboardData = await this.dashboardService.getDashboardData(user);

    return {
        success: true,
        message: 'Dashboard data retrieved successfully',
        timestamp: new Date().toISOString(),
        ...dashboardData,
    }
        
    } catch (error) {
        this.logger.error(`Error retrieving dashboard data for user: ${user.id}`, error);
        throw error;
    }

  }
}
