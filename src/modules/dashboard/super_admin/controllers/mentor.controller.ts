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
import { CreateMentorDto, UserRole } from 'src/common/interfaces';
import { MentorOnboardingService } from '../services/mentor-onboarding.service';
import { Mentor, User } from 'src/modules/schemas';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators';
import { LoggerService } from 'src/common/logger/logger.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('mentors')
@ApiTags('Mentor')
export class MentorController {
  constructor(
    private readonly mentorOnboardingService: MentorOnboardingService,
    private readonly logger: LoggerService,
  ) {}

  @Post('onboard')
  @UseInterceptors(FileInterceptor('image'))
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('Onboarding')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Onboard a mentor with admin user',
    description:
      'This endpoint allows the super admin to onboard a new mentor.',
  })
  @ApiResponse({
    status: 201,
    description: 'Mentor onboarded successfully',
    type: Mentor,
    isArray: false,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: CreateMentorDto,
    isArray: false,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: CreateMentorDto,
    isArray: false,
  })
  @ApiOperation({
    summary: 'Onboard a new mentor with admin user',
    description:
      'This endpoint allows the super admin to onboard a new mentor.',
  })
  async onboardMentor(
    @UploadedFile() image: Express.Multer.File,
    @Body() createMentorDto: CreateMentorDto,
    @CurrentUser() superAdmin: User,
  ): Promise<Mentor> {
    return this.mentorOnboardingService.onboardMentor(
      createMentorDto,
      superAdmin,
      image,
    );
  }

  @Get('/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('Mentor Management')
  @ApiResponse({
    status: 200,
    description: 'List of all mentors',
    type: Mentor,
    isArray: true,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: CreateMentorDto,
    isArray: false,
  })
  @ApiOperation({
    summary: 'Get all schools',
    description: 'This endpoint retrieves all mentors in the system.',
  })
  async getAllSchools(): Promise<Mentor[]> {
    try {
      return await this.mentorOnboardingService.getAllMentors();
    } catch (error) {
      this.logger.error('Error fetching all schools', error);
      throw error;
    }
  }

  //   @Delete('/delete/:id')
  //   @UseGuards(AuthGuard('jwt'), RolesGuard)
  //   @Roles(UserRole.SUPER_ADMIN)
  //   @ApiTags('Mentor Management')
  //   @ApiResponse({
  //     status: 200,
  //     description: 'Mentor deleted successfully',
  //     type: Mentor,
  //     isArray: false,
  //   })
  //   @ApiParam({
  //     name: 'id',
  //     type: String,
  //     description: 'ID of the mentor to delete',
  //   })
  //   @ApiResponse({
  //     status: 404,
  //     description: 'Mentor not found',
  //     type: CreateMentorDto,
  //     isArray: false,
  //   })
  //   @ApiResponse({
  //     status: 500,
  //     description: 'Internal Server Error',
  //     type: CreateMentorDto,
  //     isArray: false,
  //   })
  //   @ApiOperation({
  //     summary: 'Delete a school',
  //     description: 'This endpoint allows the super admin to delete a school.',
  //   })

  //   async deleteMentor(
  //     @CurrentUser() superAdmin: User,
  //     @Param('id') mentorId: string,
  //   ): Promise<void> {
  //     try {
  //       this.logger.log(
  //         `Deleting school with ID: ${mentorId} by super admin: ${superAdmin.email}`,
  //       );
  //       await this.mentorOnboardingService.deleteSchool(mentorId);
  //     } catch (error) {
  //       this.logger.error(
  //         `Error deleting school with ID: ${mentorId}`,
  //         error.stack,
  //       );
  //       throw error;
  //     }
  //   }
}
