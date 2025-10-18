import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:3001';
  }

  // Forward quiz creation request to AI microservice
  async createQuiz(userId: string, ageRange: string, token: string) {
    try {
      this.logger.log(`Creating quiz for user ${userId} with age range ${ageRange}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/quiz`,
          { userId, ageRange },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create quiz via AI service', error.message);
      throw new BadRequestException('Failed to create quiz');
    }
  }

  // Forward quiz submission to AI microservice
  async submitQuiz(quizData: any, token: string) {
    try {
      this.logger.log(`Submitting quiz ${quizData.quizId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/quiz/submit`,
          quizData,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit quiz via AI service', error.message);
      throw new BadRequestException('Failed to submit quiz');
    }
  }

  // Forward recommendations request to AI microservice
  async getRecommendations(userId: string, token: string) {
    try {
      this.logger.log(`Getting recommendations for user ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/api/ai/recommendations?userId=${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get recommendations via AI service', error.message);
      throw new NotFoundException('No recommendations found');
    }
  }

  // Forward POST recommendations request to AI microservice
  async postRecommendations(userId: string, analysisData: any, token: string) {
    try {
      this.logger.log(`Getting POST recommendations for user ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/recommendations`,
          { userId, ...analysisData },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get POST recommendations via AI service', error.message);
      throw new BadRequestException('Failed to get recommendations');
    }
  }

  // Forward career recommendations request to AI microservice
  async getCareerRecommendations(userId: string, token: string) {
    try {
      this.logger.log(`Getting career recommendations for user ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/api/ai/career-recommendations?userId=${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get career recommendations via AI service', error.message);
      throw new NotFoundException('No career recommendations found');
    }
  }

  // Forward quiz analysis request to AI microservice
  async getQuizAnalysis(userId: string, quizId: string, token: string) {
    try {
      this.logger.log(`Getting quiz analysis for user ${userId}, quiz ${quizId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/api/ai/quiz-analysis?userId=${userId}&quizId=${quizId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get quiz analysis via AI service', error.message);
      throw new NotFoundException('Quiz analysis not found');
    }
  }

  // Forward latest content request to AI microservice
  async getLatestContent(userId: string, token: string) {
    try {
      this.logger.log(`Getting latest content for user ${userId}`);
      
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.aiServiceUrl}/api/ai/content/latest?userId=${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get latest content via AI service', error.message);
      throw new NotFoundException('No content found');
    }
  }

  // Guest quiz creation
  async createGuestQuiz(sessionId: string, ageRange: string) {
    try {
      this.logger.log(`Creating guest quiz for session ${sessionId} with age range ${ageRange}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/guest/quiz`,
          { sessionId, ageRange }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create guest quiz via AI service', error.message);
      throw new BadRequestException('Failed to create guest quiz');
    }
  }

  // Guest quiz submission
  async submitGuestQuiz(quizData: any) {
    try {
      this.logger.log(`Submitting guest quiz ${quizData.quizId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/guest/quiz/submit`,
          quizData
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to submit guest quiz via AI service', error.message);
      throw new BadRequestException('Failed to submit guest quiz');
    }
  }

  // Guest recommendations
  async getGuestRecommendations(sessionId: string, analysisData: any) {
    try {
      this.logger.log(`Getting guest recommendations for session ${sessionId}`);
      
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/api/ai/guest/recommendations`,
          { sessionId, ...analysisData }
        )
      );
      
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get guest recommendations via AI service', error.message);
      throw new BadRequestException('Failed to get guest recommendations');
    }
  }

  // Test AI service health
  async testAiService() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/api/ai/health`)
      );
      
      return {
        status: 'healthy',
        aiService: response.data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('AI service health check failed', error.message);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}