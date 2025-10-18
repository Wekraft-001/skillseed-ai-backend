import { Body, Controller, Get, Post, Query, UseGuards, Logger, Headers } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AiGatewayService } from './ai-gateway.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators';
import { User } from '../schemas';
import { UserRole } from 'src/common/interfaces';

@Controller('ai')
@ApiTags('AI TOOLS')
export class AiGatewayController {
  private readonly logger = new Logger(AiGatewayController.name);
  
  constructor(private readonly aiGatewayService: AiGatewayService) {}

  // Signed-in student quiz creation
  @Post('quiz')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a quiz for a signed-in student' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ageRange: { type: 'string', enum: ['6-8', '9-12', '13-15', '16-18'] },
      },
      required: ['ageRange'],
    },
  })
  async createQuiz(
    @CurrentUser() user: User,
    @Body() body: { ageRange: string },
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.createQuiz((user as any)._id, body.ageRange, token);
  }

  // Signed-in student quiz submit
  @Post('quiz/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit answers for a student quiz' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quizId: { type: 'string' },
        answers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of answer indices',
        },
      },
      required: ['quizId', 'answers'],
    },
  })
  async submitQuiz(
    @CurrentUser() user: User,
    @Body() body: { quizId: string; answers: number[] },
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    const quizData = {
      ...body,
      userId: (user as any)._id,
    };
    return this.aiGatewayService.submitQuiz(quizData, token);
  }

  // POST method for getting recommendations
  @Post('recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get educational content recommendations for a student (POST method)' })
  async postRecommendations(
    @CurrentUser() user: User,
    @Body() body: any,
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.postRecommendations((user as any)._id, body, token);
  }

  // GET method for getting recommendations
  @Get('recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get educational content recommendations for a student' })
  async getRecommendations(
    @CurrentUser() user: User,
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.getRecommendations((user as any)._id, token);
  }

  // Career recommendations
  @Get('career-recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get career recommendations based on completed quiz' })
  async getCareerRecommendations(
    @CurrentUser() user: User,
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.getCareerRecommendations((user as any)._id, token);
  }

  // Quiz analysis for debugging
  @Get('quiz-analysis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get raw quiz analysis for debugging (development only)' })
  async getQuizAnalysis(
    @CurrentUser() user: User,
    @Query('quizId') quizId: string,
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.getQuizAnalysis((user as any)._id, quizId, token);
  }

  // Latest educational content
  @Get('content/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get latest educational content for current student' })
  async getLatestContent(
    @CurrentUser() user: User,
    @Headers('authorization') authorization: string,
  ) {
    const token = authorization?.replace('Bearer ', '');
    return this.aiGatewayService.getLatestContent((user as any)._id, token);
  }

  // Guest quiz creation
  @Post('guest/quiz')
  @ApiOperation({ summary: 'Create a guest (anonymous) quiz' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Guest session identifier' },
        ageRange: { type: 'string', enum: ['6-8', '9-12', '13-15', '16-18'] },
      },
      required: ['sessionId', 'ageRange'],
    },
  })
  async createGuestQuiz(@Body() body: { sessionId: string; ageRange: string }) {
    return this.aiGatewayService.createGuestQuiz(body.sessionId, body.ageRange);
  }

  // Guest quiz submission
  @Post('guest/quiz/submit')
  @ApiOperation({ summary: 'Submit answers for guest quiz and get analysis' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quizId: { type: 'string' },
        sessionId: { type: 'string' },
        answers: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of answer indices',
        },
      },
      required: ['quizId', 'sessionId', 'answers'],
    },
  })
  async submitGuestQuiz(@Body() body: { quizId: string; sessionId: string; answers: number[] }) {
    return this.aiGatewayService.submitGuestQuiz(body);
  }

  // Guest recommendations
  @Post('guest/recommendations')
  @ApiOperation({ summary: 'Get guest recommendations after analysis' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        analysisData: { type: 'object' },
      },
      required: ['sessionId'],
    },
  })
  async getGuestRecommendations(@Body() body: { sessionId: string; analysisData?: any }) {
    return this.aiGatewayService.getGuestRecommendations(body.sessionId, body.analysisData || {});
  }

  // Test AI service health (development only)
  @Get('test/youtube')
  @ApiOperation({ summary: 'Test YouTube API integration (development only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'AI service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        aiService: { type: 'object' },
        timestamp: { type: 'string' }
      }
    }
  })
  async testAiService() {
    return this.aiGatewayService.testAiService();
  }
}