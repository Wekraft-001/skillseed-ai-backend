import {
  BadRequestException,
  ForbiddenException,
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
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
      maxRetries: 2,
    });
  }

  async generateCareerQuiz(
    user: User,
    userAgeRange: string,
  ): Promise<CareerQuiz> {
    const validAgeRanges = ['6-8', '9-12', '13-15', '16-17'];
    if (!validAgeRanges.includes(userAgeRange)) {
      throw new BadRequestException(
        `Invalid userAgeRange: ${userAgeRange}. Must be one of: ${validAgeRanges.join(', ')}`,
      );
    }

    const ageScales = {
      '6-8': {
        scale: [
          '😞 Not at all',
          '😐 A little',
          '🙂 Sometimes',
          '😀 Often',
          '🤩 A lot',
        ],
        phases: [
          'What Makes You Smile?',
          'Your Superpowers',
          'If You Could...',
        ],
        funBreaks: [
          'Unlock a “Smile Star” badge and do a 30-sec dance break with an animation.',
          '“Power-Up” moment – they get a virtual cape or badge: “Super Helper” or “Creative Star.”',
          'Reveal their “Imagination Avatar” with a fun description like: “Future Inventor” or “Dreamy Designer.”',
        ],
      },
      '9-12': {
        scale: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
        phases: ['What Do You Enjoy?', 'How Do You Work?', 'Dream Job Fun'],
        funBreaks: [
          'Roll a digital dice to reveal “hidden powers” like “The Curious Leader” or “Imaginative Explorer.”',
          'Unlock a new “Toolbox Skill” (like Focus, Leadership, Curiosity), with a sound effect or animation.',
          'Career Card Reveal — “You’d shine as a Creative Director or Young Scientist!”',
        ],
      },
      '13-15': {
        scale: [
          'Strongly Disagree',
          'Disagree',
          'Neutral',
          'Agree',
          'Strongly Agree',
        ],
        phases: [
          'How You See the World',
          'Who You Are With Others',
          'You in the Future',
        ],
        funBreaks: [
          '“Mind Map Reveal” — a glowing web shows their top thinking strengths.',
          'They earn a “Team Type” — e.g., “The Motivator,” “The Organizer,” or “The Listener.”',
          'They unlock their “Impact Identity” — “World Builder,” “Creative Force,” “Future Leader.”',
        ],
      },
      '16-17': {
        scale: ['Very Untrue', 'Untrue', 'Neutral', 'True', 'Very True'],
        phases: [
          'Values and Strengths',
          'Skills and Style',
          'Vision & Career Match',
        ],
        funBreaks: [
          'Values visualization — a glowing “constellation” that connects their key values.',
          'Unlock their “Skill DNA” — with highlights like “Decision-Maker,” “Strategist,” or “Vision Mapper.”',
          'Reveal a “Career Launchpad” with 3 potential future journeys they can explore deeper.',
        ],
      },
    };

    let ageRange: string;
    if (user.age >= 6 && user.age <= 8) ageRange = '6-8';
    else if (user.age >= 9 && user.age <= 12) ageRange = '9-12';
    else if (user.age >= 13 && user.age <= 15) ageRange = '13-15';
    else if (user.age >= 16 && user.age <= 17) ageRange = '16-17';
    else throw new BadRequestException('Age must be between 6 and 17');

    const { scale, phases, funBreaks } = ageScales[ageRange];

    const prompt = `
    Create a fun and interactive career discovery quiz for a child aged ${user.age} (age range ${ageRange}). The quiz should have 3 phases, each with 10 questions, similar to the following structure:
    Phases: ${phases.join(', ')}
    Answer scale: ${scale.join(', ')}
    Fun breaks: After each phase, include a fun break idea like: ${funBreaks.join(', ')}
    For each phase, generate 3-6 questions that align with the theme of the phase and are appropriate for the age group. Each question must have ${scale.length} multiple-choice answer options matching the scale exactly (e.g., ${scale.join(', ')}). Format the output as a JSON object with the following structure:

    {
      "phases": [
        {
          "name": "Phase name",
          "questions": [
            {
              "text": "Question text",
              "answers": ["${scale[0]}", "${scale[1]}", ..., "${scale[scale.length - 1]}"]
            },
            ...
          ],
          "funBreak": "Fun break description"
        },
        ...
      ]
    }

    Ensure the questions are engaging, age-appropriate, and encourage self-reflection. The fun breaks should be interactive and rewarding, like earning badges or unlocking fun animations.

    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const quizContent = JSON.parse(response.choices[0].message.content || '{}');
    if (!quizContent.phases || !Array.isArray(quizContent.phases)) {
      throw new BadRequestException('Invalid quiz content format');
    }

    const quiz = await this.quizModel.create({
      user: user._id,
      ageRange,
      phases: quizContent.phases,
      completed: false,
      answers: [],
      analysis: '',
    });

    return quiz;
  }

  async getAllQuizzes(currentUser: User): Promise<CareerQuiz[]> {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    return await this.quizModel.find().populate('user').exec();
  }

  async analyzeAnswers(dto: SubmitAnswersDto): Promise<any> {
    const quiz = await this.quizModel
      .findById(dto.quizId)
      .populate('user')
      .exec();
    if (!quiz) throw new NotFoundException('Quiz not found');

    if (!dto.answers || !Array.isArray(dto.answers)) {
      throw new BadRequestException('Answers array is missing or invalid');
    }

    const answersText: string[] = [];

    for (const answer of dto.answers) {
      const phase = quiz.phases[answer.phaseIndex];
      if (!phase) {
        throw new BadRequestException(
          `Invalid phase index: ${answer.phaseIndex}`,
        );
      }
      const question = phase.questions[answer.questionIndex];
      if (!question) {
        throw new BadRequestException(
          `Invalid questionIndex: ${answer.questionIndex} `,
        );
      }

      answersText.push(`Question: ${question.text}\nAnswer: ${answer.answer}`);
    }

    // const answers = dto.answers
    //   .sort((a, b) =>
    //     a.phaseIndex !== b.phaseIndex
    //       ? a.phaseIndex - b.phaseIndex
    //       : a.questionIndex - b.questionIndex,
    //   )
    //   .map((a) => {
    //     const questionText =
    //       quiz.phases[a.phaseIndex].questions[a.questionIndex].text;
    //     return `Question: ${questionText}\nAnswer: ${a.answer}`;
    //   })
    //   .join('\n\n');

    const prompt = `Given the following answers from a child... 
      You are a career counselor analyzing a student's responses to career assessment questions. 
      Based on the following questions and answers, provide a comprehensive career analysis and recommendations.

      ${answersText.join('\n\n')}

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

    quiz.userAnswers = dto.answers;
    quiz.completed = true;
    quiz.analysis = analysis;
    await quiz.save();

    return {
      analysis,
      quizId: quiz._id.toString(),
      userId: quiz.user._id.toString(),
      answers: quiz.userAnswers,
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

    if (!quiz || !quiz.completed || !quiz.analysis || !quiz.userAnswers) {
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
      answers: quiz.userAnswers,
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
