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
import { SchoolDashboardService } from '../services/index';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/common/interfaces';
import { CreateStudentDto } from 'src/modules/auth/dtos';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/modules/schemas';
import { Model } from 'mongoose';

@Controller('school/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN)
export class SchoolDashboardController {
  constructor(
    private readonly schoolDashboardService: SchoolDashboardService,
    private readonly logger: LoggerService,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  @Get()
  async getDashboard(@Request() req) {
    const currentUser = req.user;
    return this.schoolDashboardService.getDashboardData(currentUser);
  }

  @Post('register-student')
  @UseInterceptors(FileInterceptor('image'))
  async registerStudent(
    @UploadedFile() image: Express.Multer.File,
    @Body() createStudentDto: CreateStudentDto,
    @Request() req,
  ) {
    const currentUser = req.user;
    return this.schoolDashboardService.registerStudentBySchoolAdmin(
      createStudentDto,
      currentUser,
      image,
    );
  }

  @Get('students')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SCHOOL_ADMIN)
  async getStudents(@Request() req) {
    const user = req.user;
    try {
      this.logger.log(`Fetching students for user: ${user.email}`);
      return await this.schoolDashboardService.getStudentsForUser(user);
    } catch (error) {
      this.logger.error(`Error fetching students for user: ${user._id}`, error);
      throw error;
    }
  }
}
