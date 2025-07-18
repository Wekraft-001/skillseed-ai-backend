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
import { UserRole } from 'src/common/interfaces';
import { CreateStudentDto } from 'src/modules/auth/dtos';
import { FileInterceptor } from '@nestjs/platform-express';
import { LoggerService } from 'src/common/logger/logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { User } from 'src/modules/schemas';
import { Model } from 'mongoose';

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

  @Post('register-student')
  @UseInterceptors(FileInterceptor('image'))
  async registerStudent(
    @UploadedFile() image: Express.Multer.File,
    @Body() createStudentDto: CreateStudentDto,
    @Request() req,
  ) {
    const currentUser = req.user;
    return this.parentDashboardService.registerStudentByParent(
      createStudentDto,
      currentUser,
      image,
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
