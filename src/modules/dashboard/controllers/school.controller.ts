import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateSchoolDto, UserRole } from 'src/common/interfaces';
import { SchoolOnboardingService } from '../services';
import { School } from 'src/modules/schemas/school.schema';
import { User } from 'src/modules/schemas';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators';
import { LoggerService } from 'src/common/logger/logger.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('schools')
@ApiTags('School')
export class SchoolController {
  constructor(
    private readonly schoolOnboardingService: SchoolOnboardingService,
    private readonly logger: LoggerService,
  ) {}

  @Post('onboard')
  @UseInterceptors(FileInterceptor('logo'))
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('Onboarding')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Onboard a new school with admin user',
    description:
      'This endpoint allows the super admin to onboard a new school.',
  })
  @ApiResponse({
    status: 201,
    description: 'School onboarded successfully',
    type: School,
    isArray: false,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: CreateSchoolDto,
    isArray: false,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: CreateSchoolDto,
    isArray: false,
  })
  @ApiOperation({
    summary: 'Onboard a new school with admin user',
    description:
      'This endpoint allows the super admin to onboard a new school.',
  })
  async onboardSchool(
    @UploadedFile() logo: Express.Multer.File,
    @Body() createSchoolDto: CreateSchoolDto,
    @CurrentUser() superAdmin: User,
  ): Promise<School> {

    return this.schoolOnboardingService.onboardSchool(
      createSchoolDto,
      superAdmin,
      logo,
    );
  }

  @Get('/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('School Management')
  @ApiResponse({
    status: 200,
    description: 'List of all schools',
    type: School,
    isArray: true,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: CreateSchoolDto,
    isArray: false,
  })
  @ApiOperation({
    summary: 'Get all schools',
    description: 'This endpoint retrieves all schools in the system.',
  })
  async getAllSchools(): Promise<School[]> {
    try {
      return await this.schoolOnboardingService.getAllSchools();
    } catch (error) {
      this.logger.error('Error fetching all schools', error);
      throw error;
    }
  }

  @Delete('/delete/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('School Management')
  @ApiResponse({
    status: 200,
    description: 'School deleted successfully',
    type: School,
    isArray: false,
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID of the school to delete',
  })
  @ApiResponse({
    status: 404,
    description: 'School not found',
    type: CreateSchoolDto,
    isArray: false,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: CreateSchoolDto,
    isArray: false,
  })
  @ApiOperation({
    summary: 'Delete a school',
    description: 'This endpoint allows the super admin to delete a school.',
  })
  async deleteSchool(
    @CurrentUser() superAdmin: User,
    @Param('id') schoolId: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Deleting school with ID: ${schoolId} by super admin: ${superAdmin.email}`,
      );
      await this.schoolOnboardingService.deleteSchool(schoolId);
    } catch (error) {
      this.logger.error(
        `Error deleting school with ID: ${schoolId}`,
        error.stack,
      );
      throw error;
    }
  }
}
