import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParentDashboardService } from '../services/dashboard.service';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateSubscriptionDto, UserRole } from 'src/common/interfaces';
import { CreateStudentDto, TempStudentDataDto } from 'src/modules/auth/dtos';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/modules/schemas';
import { Model } from 'mongoose';
import { CurrentUser } from 'src/common/decorators';
import { ApiBadRequestResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('parent/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PARENT)
export class ParentDashboardController {
  constructor(
    private readonly parentDashboardService: ParentDashboardService,
    private readonly logger: LoggerService,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  @Get()
  async getDashboard(@Request() req) {
    const currentUser = req.user;
    return this.parentDashboardService.getDashboardData(currentUser);
  }

  @ApiTags('Authentication')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiOperation({ summary: 'Register a new user ' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request - Invalid input data',
  })
  @Post('register-student')
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.PARENT)
  async registerStudent(
    @UploadedFile() image: Express.Multer.File,
    @Body() body: TempStudentDataDto,
    @CurrentUser() user: User,
  ) {
    // const currentUser = req.user;
    return this.parentDashboardService.initiateStudentRegistration(
      body,
      user,
      image
    );
  }


  @Get('students')
  @HttpCode(HttpStatus.OK)
  async getStudents(@Request() req) {
    const user = req.user;
    try {
      this.logger.log(`Fetching students for user: ${user.email}`);
      return await this.parentDashboardService.getStudentsForUser(user);
    } catch (error) {
      this.logger.error(`Error fetching students for user: ${user._id}`, error);
      throw error;
    }
  }
}
