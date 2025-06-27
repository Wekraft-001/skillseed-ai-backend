import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { LoggerService } from 'src/common/logger/logger.service';
import { CareerQuiz } from '../schemas/career-quiz.schema';
import { IsNull, Not, Repository } from 'typeorm';
import { EducationalContent, User } from '../schemas';
import { SubmitAnswersDto, UserRole } from 'src/common/interfaces';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
    @InjectRepository(CareerQuiz)
    private readonly quizRepo: Repository<CareerQuiz>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EducationalContent)
    private readonly eduContentRepo: Repository<EducationalContent>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_API_KEY'),
      maxRetries: 2,
    });
  }

  async generateCareerQuiz(user: User): Promise<CareerQuiz> {
    try {
      const prompt = `Create 5 discovery questions for a child aged ${user.age} that assess: 
        - Preferences (hands-on, reading, building, helping)
        - Emotional and cognitive traits
        - Self-perception ("I like solving puzzles", etc.)

        Keep questions simple and friendly.
        `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.choices[0].message.content || '';
      const questions = content
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => line.replace(/^\d+\.\s*/, '').trim());

      const quiz = this.quizRepo.create({ user, questions });

      return await this.quizRepo.save(quiz);
    } catch (error) {
      this.logger.error('OpenAI API Error: ', error);

      if (error.status === 429) {
        throw new Error(
          'OpenAI API  rate limit exceeded. Please check your account status.',
        );
      }

      throw error;
    }
  }

  async getAllQuizzes(): Promise<CareerQuiz[]> {
    return await this.quizRepo.find({
      relations: ['user'],
    });
  }

  async analyzeAnswers(dto: SubmitAnswersDto): Promise<any> {
    try {
      const quiz = await this.quizRepo.findOne({
        where: { id: dto.quizId },
        relations: ['user'],
      });
      if (!quiz) {
        throw new Error('Quiz not found');
      }

      if (
        !dto.answers ||
        !Array.isArray(dto.answers) ||
        dto.answers.length !== quiz.questions.length ||
        !dto.answers.every(
          (answer) =>
            typeof answer.questionIndex === 'number' &&
            typeof answer.answers === 'string',
        )
      ) {
        throw new BadRequestException(
          'Answers are missing or do not match the number of questions.',
        );
      }

      const answers = dto.answers
        .sort((a, b) => a.questionIndex - b.questionIndex)
        .map((a) => a.answers);

      const prompt = `
        Given the following answers from a child: 
        ${quiz.questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join('\n')}

        Generate: 
        - Personality Type (Creator, Solver, Nurture, Builder, or any you thing is best fit)
        - Suggested Carreer Clusters
        - Interests
        - Strengths & Growth Areas
        - Recommended Learning Style(Visual, Kinesthetic, Auditory, etc.)
        `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });

      const analysis = response.choices[0].message.content || '';

      quiz.answers = answers;
      quiz.completed = true;
      quiz.analysis = analysis;
      await this.quizRepo.save(quiz);

      return {
        analysis,
        quizId: quiz.id,
        userId: quiz.user.id,
        answers: quiz.answers,
      };
    } catch (error) {
      this.logger.error('OpenAI API Error: ', error);
      throw error;
    }
  }

  async submitAnswers(dto: SubmitAnswersDto, userId: number) {
    try {
      const { quizId, answers } = dto;
      const quiz = await this.quizRepo.findOne({
        where: { id: quizId },
        relations: ['user'],
      });
      if (!quiz) {
        throw new Error('Quiz not found');
      }
      if (quiz.user.id !== userId) {
        throw new Error(
          'You are not authorized to submit answers for this quiz',
        );
      }
      if (quiz.completed) {
        throw new Error('Quiz already completed');
      }

      this.logger.log(
        `Received answers for quiz ${quizId}: ${JSON.stringify(answers)}`,
      );
      return this.analyzeAnswers(dto);
    } catch (error) {
      this.logger.error('Error submitting answers: ', error);
      throw error;
    }
  }

  async generateProfileOutcome(
    dto: SubmitAnswersDto,
    userId: number,
  ): Promise<any> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['quizzes'],
      });
      const quiz = await this.quizRepo.findOne({
        where: { id: dto.quizId, user: { id: userId } },
        relations: ['user'],
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }
      if (!quiz.completed || !quiz.answers || !quiz.analysis) {
        throw new BadRequestException(
          'Quiz is not completed or missing answers/analysis',
        );
      }

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const prompt = ` 
      Based on the following quiz data for a child aged ${user.age}: 
      Questions and Answers: 
      ${quiz.questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${quiz.answers[i]}`).join('\n')}

      Previous Analysis: 
      ${quiz.analysis}

      Generate a detailed profile outcome that includes:

      - A summary of the child's personality and interests
      - Recommended career paths based on their interests and strengths
      - Suggested activities or hobbies to nurture their skills
      - A motivation message tailored to the child, name: ${user.firstName}.
      Keep the tone friendly and encouraging, and suitable for a young audience.

      `;
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });

      const profileOutcome = response.choices[0].message.content || '';

      return {
        profileOutcome,
        quizId: quiz.id,
        userId: user.id,
        answers: quiz.answers,
        previousAnalysis: quiz.analysis,
      };
    } catch (error) {
      this.logger.error('Error generating profile outcome: ', error);
      throw error;
    }
  }

  async generateEducationalContent(
    userId: number,
  ): Promise<EducationalContent> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['quizzes'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role !== UserRole.STUDENT) {
        throw new BadRequestException(
          'Only students can generate educational content',
        );
      }

      const latestQuiz = await this.getLatestQuiz(userId);
      if (!latestQuiz || !latestQuiz.analysis) {
        throw new BadRequestException('No completed quiz found for this user');
      }

      const prompt = `Generate personalized educational content for a ${user.age}-year-old child name ${user.firstName} based on this profile: 
      personality and Interests: 
      ${latestQuiz.analysis}
      Recommended Activities: 
      ${latestQuiz.analysis.includes('Recommended activities') ? latestQuiz.analysis.split('Recommended activities:')[1] : 'Not specified'}

      Create a mix of: 
      - 2 educational videos recommendations (must include YouTube links if possible, if none found, use placeholder links like "https://youtube.com/example)
      - 3 book recommandations with title, author, reading level, and theme
      - 2 interactives games that aligns with their skills

      Format the response as JSON with the following structure: 
      {
       "videos":[{"title": string, "url": string}],
       "books":[{"title": string, "author": string, "level": string, "theme": string }],
       "games": [{"name": string, "url": string, "skill": string}]
      }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });

      const JsonEducationContent = JSON.parse(
        response.choices[0].message.content || '{}',
      );

      const educationalContent = new EducationalContent();
      educationalContent.user = user;
      educationalContent.videoUrl = JsonEducationContent.video || [];
      educationalContent.books = JsonEducationContent.books || [];
      educationalContent.games = JsonEducationContent.games || [];

      return await this.eduContentRepo.save(educationalContent);
    } catch (error) {
      this.logger.error('Error generating educational content: ', error);
      throw error;
    }
  }

  private async getLatestQuiz(userId: number): Promise<CareerQuiz | null> {
    try {
      return await this.quizRepo.findOne({
        where: { user: { id: userId }, analysis: Not(IsNull()) },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      this.logger.error('Error fetching latest quiz: ', error);
      throw new error;
      
    }
  }
}
