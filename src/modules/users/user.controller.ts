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
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from '../ai/ai.service';
import { UserService } from './user.service';
import { SubmitAnswersDto, UserRole } from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { User } from '../entities';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('users')
export class UserController {
  constructor(
    private readonly aiService: AiService,
    private readonly userServices: UserService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@CurrentUser() user) {
    return user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('quiz')
  async getQuiz(@Req() req) {
    return this.aiService.generateCareerQuiz(req.user);
  }

  @Get('all')
  async getAllUsers() {
    return this.userServices.findAllUsers();
  }

  @Get('quiz/all')
  async getAllQuizzes() {
    return this.aiService.getAllQuizzes();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('quiz/:id/answers')
  async sumbitQuizAnswers(
    @Param('id', ParseIntPipe) id: number,
    @Body() answersDto: SubmitAnswersDto,
    @CurrentUser() user: User,
  ) {
    if (id !== answersDto.quizId) {
      throw new BadRequestException('Quiz ID does not match');
    }
    return this.aiService.submitAnswers(answersDto, user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('quiz/:id/generate-profile')
  async generateProfileOutCome(
    @Param('id', ParseIntPipe) quizId: number,
    // @Body() dto: SubmitAnswersDto,
    @CurrentUser() user: User,
  ) {
    const dto = new SubmitAnswersDto();
    dto.quizId = quizId;

    return this.aiService.generateProfileOutcome(dto, user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post('/gen-educ-content')
  @Roles(UserRole.STUDENT)
  @ApiOperation({summary: 'Generate educational content for the user'})
  @ApiResponse({ status: 200, description: 'Educational content generated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid user role or no quiz analysis found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generateEducationalContent(
    @CurrentUser() user: User,
  ) {
    if( user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can generate educational content');
    }
    return await this.aiService.generateEducationalContent(user.id)
  }
}
