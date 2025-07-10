import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import OpenAI from 'openai';
import { Model, Types } from 'mongoose';
import { LoggerService } from 'src/common/logger/logger.service';
import { CareerQuiz, CareerQuizDocument } from '../schemas/career-quiz.schema';
import {
  EducationalContent,
  EducationalContentDocument,
  User,
  UserDocument,
} from '../schemas';
import { SubmitAnswersDto, UserRole } from 'src/common/interfaces';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,

    @InjectModel(CareerQuiz.name)
    private readonly quizModel: Model<CareerQuizDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(EducationalContent.name)
    private readonly eduContentModel: Model<EducationalContentDocument>,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_API_KEY'),
      maxRetries: 2,
    });
  }

  async generateCareerQuiz(user: User): Promise<CareerQuiz> {
    const prompt = `Create 5 discovery questions for a child aged ${user.age}...`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const questions = (response.choices[0].message.content || '')
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^\d+\.\s*/, '').trim());

    const quiz = await this.quizModel.create({
      user: user._id,
      questions,
    });

    return quiz;
  }

  async getAllQuizzes(): Promise<CareerQuiz[]> {
    return await this.quizModel.find().populate('user').exec();
  }

  async analyzeAnswers(dto: SubmitAnswersDto): Promise<any> {
    const quiz = await this.quizModel
      .findById(dto.quizId)
      .populate('user')
      .exec();
    if (!quiz) throw new NotFoundException('Quiz not found');

    if (
      !dto.answers ||
      !Array.isArray(dto.answers) ||
      dto.answers.length !== quiz.questions.length ||
      !dto.answers.every(
        (a) =>
          typeof a.questionIndex === 'number' && typeof a.answers === 'string',
      )
    ) {
      throw new BadRequestException(
        'Answers are missing or do not match the number of questions.',
      );
    }

    const answers = dto.answers
      .sort((a, b) => a.questionIndex - b.questionIndex)
      .map((a) => a.answers);

    const prompt = `Given the following answers from a child... 
      You are a career counselor analyzing a student's responses to career assessment questions. 
      Based on the following questions and answers, provide a comprehensive career analysis and recommendations.
        
      ${answers}
        
      Please provide:
      1. Analysis of the student's interests and strengths
      2. Potential career paths that align with their responses
      3. Skills they should develop
      4. Educational recommendations
      5. Next steps for career exploration
        
      Format your response in a clear, encouraging manner suitable for a student.
  `.trim();

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = response.choices[0].message.content || '';

    quiz.answers = answers;
    quiz.completed = true;
    quiz.analysis = analysis;
    await quiz.save();

    return {
      analysis,
      quizId: quiz._id.toString(),
      userId: quiz.user._id.toString(),
      answers: quiz.answers,
    };
  }

  async submitAnswers(dto: SubmitAnswersDto, userId: string) {
    const quiz = await this.quizModel
      .findById(dto.quizId)
      .populate('user')
      .exec();
    if (!quiz) throw new NotFoundException('Quiz not found');

    if (quiz.user._id.toString() !== userId.toString()) {
      throw new BadRequestException(
        'You are not authorized to submit answers for this quiz',
      );
    }

    if (quiz.completed) throw new BadRequestException('Quiz already completed');

    this.logger.log(
      `Received answers for quiz ${dto.quizId}: ${JSON.stringify(dto.answers)}`,
    );

    return this.analyzeAnswers(dto);
  }

  async generateProfileOutcome(dto: SubmitAnswersDto, userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const quiz = await this.quizModel
      .findOne({ _id: dto.quizId, user: userId })
      .exec();

    if (!quiz || !quiz.completed || !quiz.analysis || !quiz.answers) {
      throw new BadRequestException(
        'Quiz is not completed or missing answers/analysis',
      );
    }

    const prompt = `Based on the following quiz data for a child aged ${user.age}...`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const profileOutcome = response.choices[0].message.content || '';

    return {
      profileOutcome,
      quizId: quiz._id.toString(),
      userId: user._id.toString(),
      answers: quiz.answers,
      previousAnalysis: quiz.analysis,
    };
  }

  async generateEducationalContent(
    userId: string,
  ): Promise<EducationalContent> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) throw new NotFoundException('User not found');
    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can generate content');
    }

    const latestQuiz = await this.getLatestQuiz(userId);
    if (!latestQuiz || !latestQuiz.analysis) {
      throw new BadRequestException('No completed quiz found');
    }

    const prompt = `Generate personalized educational content for a ${user.age}-year-old child name ${user.firstName}...`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const JsonEducationContent = JSON.parse(
      response.choices[0].message.content || '{}',
    );

    const educationalContent = await this.eduContentModel.create({
      user: user._id,
      videoUrl: JsonEducationContent.video || [],
      books: JsonEducationContent.books || [],
      games: JsonEducationContent.games || [],
    });

    return educationalContent;
  }

  private async getLatestQuiz(userId: string): Promise<CareerQuiz | null> {
    return this.quizModel
      .findOne({ user: userId, analysis: { $ne: null } })
      .sort({ createdAt: -1 })
      .exec();
  }
}
