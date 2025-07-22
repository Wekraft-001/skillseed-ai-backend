import {
  Controller,
  Get,
  UseGuards,
  Req,
  Post,
  Body,
  BadRequestException,
  Param,
  ParseIntPipe,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from '../ai/ai.service';
import { UserService } from './user.service';
import {
  CreateQuizDto,
  SubmitAnswersDto,
  UserProfileDto,
  UserRole,
} from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from '../schemas';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('users')
export class UserController {
  constructor(
    private readonly aiService: AiService,
    private readonly userServices: UserService,
  ) {}

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile of the user based on the JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    UserRole.STUDENT,
    UserRole.MENTOR,
    UserRole.PARENT,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  )
  @ApiTags('User Profile')
  @ApiOkResponse({ type: UserProfileDto })
  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    return user;
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.STUDENT)
  @Post('quiz')
  async getQuiz(@Body() createQuizDto: CreateQuizDto, @CurrentUser() user: User) {
    if(!user) {
      throw new NotFoundException('User not found');

    }
    return this.aiService.generateCareerQuiz(user, createQuizDto.ageRange);
  }


  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'All users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiTags('Users')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of all users', type: [User] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Users not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @Get('all')
  async getAllUsers() {
    return this.userServices.findAllUsers();
  }



  @ApiTags('Quizzes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all quizzes' })
  @ApiResponse({
    status: 200,
    description: 'All quizzes retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
  )
  @ApiResponse({
    status: 200,
    description: 'List of all quizzes',
    type: [SubmitAnswersDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @Get('quiz/all')
  async getAllQuizzes(@CurrentUser() user: User) {
    return this.aiService.getAllQuizzes(user);
  }



  @ApiTags('Submit answers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit quiz answers' })
  @ApiResponse({
    status: 200,
    description: 'Quiz answers submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Quiz ID does not match',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.STUDENT)
  @Post('quiz/:id/answers')
  async sumbitQuizAnswers(
    @Param('id') id: string,
    @Body() answersDto: SubmitAnswersDto,
    @CurrentUser() user: User,
  ) {
  
    if (id !== answersDto.quizId) {
      throw new BadRequestException('Quiz ID does not match');
    }
    return this.aiService.submitAnswers(answersDto, (user as any)._id);
  }


  @ApiTags('Generate profile outcome')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate profile outcome based on quiz ID' })
  @ApiResponse({
    status: 200,
    description: 'Profile outcome generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Quiz ID is invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiTags('Profile Outcome')
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Profile outcome generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Quiz ID is invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.STUDENT)
  @UseGuards(AuthGuard('jwt'))
  @Post('quiz/:id/generate-profile')
  async generateProfileOutCome(
    @Param('id') quizId: string,
    @CurrentUser() user: User,
  ) {
    const dto = new SubmitAnswersDto();
    dto.quizId = quizId;

    return this.aiService.generateProfileOutcome(dto, (user as any).id);
  }
  

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('/gen-educ-content')
  @Roles(UserRole.STUDENT)
  @ApiOperation({ summary: 'Generate educational content for the user' })
  @ApiResponse({
    status: 200,
    description: 'Educational content generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid user role or no quiz analysis found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiBearerAuth()
  async generateEducationalContent(@CurrentUser() user: User) {
    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        'Only students can generate educational content',
      );
    }
    return await this.aiService.generateEducationalContent((user as any).id);
  }
}
