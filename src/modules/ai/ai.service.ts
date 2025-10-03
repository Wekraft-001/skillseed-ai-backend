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
import { RedisService } from 'src/redis/redis.service';
import { CareerQuiz, CareerQuizDocument } from '../schemas/career-quiz.schema';
import { RewardsService } from '../rewards/rewards.service';
import {
  EducationalContent,
  EducationalContentDocument,
  User,
  UserDocument,
} from '../schemas';
import { SubmitAnswersDto, UserRole } from 'src/common/interfaces';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiService {
  private openai: OpenAI;
  // Quiz data has been migrated to JSON files in the quiz-data directory
  // See files: age-scales.json, questions-6-8.json, questions-9-12.json, etc.

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService,
    // Redis injected via Global module
    private readonly redisService: RedisService,
    private readonly rewardsService: RewardsService,

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

  // Signed-in helpers (use existing logic but by userId)
  async generateCareerQuizForUserId(userId: string, userAgeRange: string) {
    this.logger.log(`Generating quiz for user ${userId} with age range ${userAgeRange}`);
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    
    // Get the quiz data from the database
    const quizDoc = await this.generateCareerQuiz(user as any, userAgeRange);
    
    this.logger.log(`Created quiz with ID: ${quizDoc._id.toString()} for user ${userId}`);
    
    // Return the quiz with a simplified format (no phases)
    return {
      quizId: quizDoc._id.toString(),
      quiz: {
        questions: quizDoc.questions.map(q => ({
          text: q.text,
          answers: q.answers,
          _id: new Types.ObjectId().toString() // Generate unique IDs for each question
        }))
      }
    };
  }

  async getLatestEducationalContentForUser(userId: string) {
    return this.eduContentModel
      .findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  // Guest flows via Redis
  private guestKey(sessionId: string, quizId?: string) {
    return quizId
      ? `guest_quiz:${sessionId}:${quizId}`
      : `guest_quiz:${sessionId}`;
  }
  
  // Helper to extract JSON from OpenAI response text
  private extractJson(text: string): string {
    // Extract JSON from the response if it's wrapped in backticks or has extra text
    const jsonMatch = text.match(/```(?:json)?([\s\S]*?)```/) || 
                      text.match(/({[\s\S]*})/);
    return jsonMatch ? jsonMatch[1].trim() : text.trim();
  }

  // Generate a guest quiz JSON using OpenAI (no DB writes)
  async generateGuestCareerQuiz(sessionId: string, ageRange: string) {
    const validAgeRanges = ['6-8', '9-12', '13-15', '16-18'];
    if (!validAgeRanges.includes(ageRange)) {
      throw new BadRequestException(
        `Invalid ageRange: ${ageRange}. Must be one of: ${validAgeRanges.join(', ')}`,
      );
    }

    try {
      // Load age scales from JSON file
      const scalesFilePath = path.join(__dirname, 'quiz-data', 'age-scales.json');
      const scalesFileContent = fs.readFileSync(scalesFilePath, 'utf8');
      const ageScales = JSON.parse(scalesFileContent);

      // Get the appropriate scale for the user's age range
      const scale = ageScales[ageRange];
      
      if (!scale) {
        throw new BadRequestException('Failed to get answer scale for the specified age range');
      }
      
      this.logger.log(`Generating AI-based guest career quiz for age range ${ageRange}`);
      
      // Generate exactly 15 questions using OpenAI
      const generatedQuestions = await this.generateAIQuestions(ageRange, 15);
      
      // Format questions with their answer scales
      const formattedQuestions = generatedQuestions.map(text => ({
        text,
        answers: scale
      }));

      // Return the quiz with questions only (no phases)
      return {
        questions: formattedQuestions
      };
    } catch (error) {
      this.logger.error(`Error generating guest career quiz: ${error.message}`);
      throw new BadRequestException(`Failed to generate quiz: ${error.message}`);
    }
  }
  
  // Helper method to generate all questions using AI for guest users
  private async generateAIQuestions(ageRange: string, count: number): Promise<string[]> {
    this.logger.log(`Generating ${count} AI questions for guest user, age range ${ageRange}`);
    
    try {
      // Load the appropriate scales for this age range
      const scalesFilePath = path.join(__dirname, 'quiz-data', 'age-scales.json');
      const scalesFileContent = fs.readFileSync(scalesFilePath, 'utf8');
      const ageScales = JSON.parse(scalesFileContent);
      const scaleType = ageScales[ageRange];
      
      // Determine the appropriate question format based on the answer scale
      let frequencyBased = false;
      let agreementBased = false;
      let truthBased = false;
      
      if (scaleType && Array.isArray(scaleType)) {
        const scaleText = scaleType.join(' ').toLowerCase();
        frequencyBased = scaleText.includes('never') || 
                        scaleText.includes('rarely') || 
                        scaleText.includes('sometimes') || 
                        scaleText.includes('often') || 
                        scaleText.includes('always') ||
                        scaleText.includes('a little') ||
                        scaleText.includes('a lot');
        
        agreementBased = scaleText.includes('agree') || scaleText.includes('disagree');
        truthBased = scaleText.includes('true') || scaleText.includes('untrue');
      }
      
      // Construct an appropriate prompt based on the scale type
      let questionFormat = '';
      
      if (frequencyBased) {
        questionFormat = `
        IMPORTANT: Format all questions as frequency-based questions that can be answered with options like:
        "Never", "Rarely", "Sometimes", "Often", "Always" or similar frequency scales.
        
        Examples of good frequency-based questions:
        - "How often do you enjoy solving puzzles?"
        - "Do you enjoy leading group activities?"
        - "How frequently do you find yourself helping others with their problems?"
        
        DO NOT generate open-ended questions like "What is your favorite subject?" as these cannot be answered with frequency scales.`;
      }
      else if (agreementBased) {
        questionFormat = `
        IMPORTANT: Format all questions as statements that can be responded to with agreement scales like:
        "Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree".
        
        Examples of good agreement-based statements:
        - "I enjoy figuring out how things work."
        - "Working with numbers comes naturally to me."
        - "I prefer to be the leader in group settings."
        
        DO NOT generate open-ended questions like "What would you like to be when you grow up?" as these cannot be answered with agreement scales.`;
      }
      else if (truthBased) {
        questionFormat = `
        IMPORTANT: Format all questions as statements about the person that can be rated on a truth scale like:
        "Very Untrue", "Untrue", "Neutral", "True", "Very True".
        
        Examples of good truth-based statements:
        - "I am someone who likes to solve complex problems."
        - "Being creative is important to me."
        - "I find it easy to organize tasks and activities."
        
        DO NOT generate open-ended questions like "What interests you the most?" as these cannot be answered with truth scales.`;
      }
      else {
        questionFormat = `
        Format all questions to be appropriate for the age range and ensure they can be answered with simple scaled responses.
        DO NOT generate open-ended questions requiring explanations or specific choices.`;
      }

      const prompt = `Generate exactly ${count} age-appropriate career exploration questions for a ${ageRange} year old child. 
      The questions should help identify their interests, skills, and preferences related to potential future careers.
      Make sure the questions are diverse and cover different aspects like:
      - Creative interests
      - Analytical thinking
      - Social interactions
      - Leadership qualities
      - Problem-solving abilities
      - Learning preferences
      
      ${questionFormat}
      
      Format each question as a separate item in a JSON array of strings.
      Do not include any explanations or text outside of the JSON array.
      Make sure questions are neutral and don't mention any specific names.
      Each question should be brief and clearly phrased for the age range.`;
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });
      
      const content = response.choices[0].message.content || '[]';
      
      // Extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn(`Failed to extract JSON array from AI response: ${content}`);
        return [];
      }
      
      try {
        const questions = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(questions) || questions.length < count) {
          this.logger.warn(`AI didn't generate enough questions (${questions.length}/${count})`);
          // If we got fewer than requested, just return what we have
          return Array.isArray(questions) ? questions : [];
        }
        return questions.slice(0, count); // Ensure we have exactly the requested number
      } catch (err) {
        this.logger.error(`Error parsing AI-generated questions: ${err.message}`);
        return [];
      }
    } catch (error) {
      this.logger.error(`Error generating AI questions: ${error.message}`);
      return [];
    }
  }

  async generateGuestQuiz(sessionId: string, ageRange: string) {
    const quiz = await this.generateGuestCareerQuiz(sessionId, ageRange);
    const quizId =
      (quiz as any)._id?.toString?.() || Math.random().toString(36).slice(2);
    await this.redisService.set(
      this.guestKey(sessionId, quizId),
      JSON.stringify({ ageRange, quiz, answers: [], analysis: null }),
      86400,
    );
    return { quizId, quiz };
  }

  async submitGuestAnswers(body: {
    sessionId: string;
    quizId: string;
    answers: { phaseIndex?: number; questionIndex: number; answer: string }[];
  }) {
    const key = this.guestKey(body.sessionId, body.quizId);
    const raw = await this.redisService.get(key);
    if (!raw) throw new NotFoundException('Guest quiz not found');
    const state = JSON.parse(raw);
    
    // Make sure answers are properly formatted - in new structure, we don't need phaseIndex
    const formattedAnswers = body.answers.map(answer => ({
      questionIndex: answer.questionIndex,
      answer: answer.answer,
      // Include phaseIndex as 0 if missing to maintain backward compatibility
      phaseIndex: answer.phaseIndex !== undefined ? answer.phaseIndex : 0
    }));
    
    const result = await this.analyzeGuestAnswers({
      sessionId: body.sessionId,
      quizId: body.quizId,
      answers: formattedAnswers,
    });
    
    state.answers = formattedAnswers;
    state.analysis = result.analysis;
    await this.redisService.set(key, JSON.stringify(state), 86400);
    return result;
  }

  // Analyze guest answers and return analysis; state is kept in Redis by caller
  async analyzeGuestAnswers(params: {
    sessionId: string;
    quizId: string;
    answers: { phaseIndex?: number; questionIndex: number; answer: string }[];
  }) {
    const key = this.guestKey(params.sessionId, params.quizId);
    const raw = await this.redisService.get(key);
    if (!raw) throw new NotFoundException('Guest quiz not found');
    const state = JSON.parse(raw);

    const answersText: string[] = [];
    for (const a of params.answers) {
      // Use the new structure with questions at top level
      const question = state.quiz?.questions?.[a.questionIndex];
      if (!question) continue;
      answersText.push(`Question: ${question.text}\nAnswer: ${a.answer}`);
    }

    // Enhanced prompt that explicitly instructs to avoid using names for guests
    const prompt = `Given the following answers from a child (age range: ${state.ageRange}), provide a short, friendly profile and recommendations. 
    
Important: This is for a guest user who is not signed in. DO NOT use any specific names or personal identifiers in your response. 
Address the recommendations to "you" or "the child" rather than using any names.

${answersText.join('\n\n')}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = response.choices[0].message.content || '';
    return {
      analysis,
      quizId: params.quizId,
      answers: params.answers,
    };
  }

  // Guest recommendations removed
  async generateGuestRecommendations(params: {
    sessionId: string;
    quizId: string;
  }) {
    throw new BadRequestException(
      'Guest recommendations are not available. Please register to get personalized recommendations.',
    );
  }

  async generateCareerQuiz(
    user: User,
    userAgeRange: string,
  ): Promise<CareerQuiz> {
    const validAgeRanges = ['6-8', '9-12', '13-15', '16-18'];
    if (!validAgeRanges.includes(userAgeRange)) {
      throw new BadRequestException(
        `Invalid userAgeRange: ${userAgeRange}. Must be one of: ${validAgeRanges.join(', ')}`,
      );
    }

    // Only use phases and funBreaks from hardcoded data, scales will be loaded from JSON
    const phaseData = {
      '6-8': {
        phases: [
          'What Makes You Smile?',
          'Your Superpowers',
          'If You Could...',
        ],
        funBreaks: [
          'Unlock a "Smile Star" badge and do a 30-sec dance break with an animation.',
          '"Power-Up" moment – they get a virtual cape or badge: "Super Helper" or "Creative Star."',
          'Reveal their "Imagination Avatar" with a fun description like: "Future Inventor" or "Dreamy Designer."',
        ],
      },
      '9-12': {
        phases: ['What Do You Enjoy?', 'How Do You Work?', 'Dream Job Fun'],
        funBreaks: [
          'Roll a digital dice to reveal "hidden powers" like "The Curious Leader" or "Imaginative Explorer."',
          'Unlock a new "Toolbox Skill" (like Focus, Leadership, Curiosity), with a sound effect or animation.',
          'Career Card Reveal — "You\'d shine as a Creative Director or Young Scientist!"',
        ],
      },
      '13-15': {
        phases: [
          'How You See the World',
          'Who You Are With Others',
          'You in the Future',
        ],
        funBreaks: [
          '"Mind Map Reveal" — a glowing web shows their top thinking strengths.',
          'They earn a "Team Type" — e.g., "The Motivator," "The Organizer," or "The Listener."',
          'They unlock their "Impact Identity" — "World Builder," "Creative Force," "Future Leader."',
        ],
      },
      '16-18': {
        phases: [
          'Values and Strengths',
          'Skills and Style',
          'Vision & Career Match',
        ],
        funBreaks: [
          'Values visualization — a glowing "constellation" that connects their key values.',
          'Unlock their "Skill DNA" — with highlights like "Decision-Maker," "Strategist," or "Vision Mapper."',
          'Reveal a "Career Launchpad" with 3 potential future journeys they can explore deeper.',
        ],
      },
    };

    const ageRange = userAgeRange;
    
    // Log which age range we're using
    this.logger.log(`Using age range: ${ageRange} for user ${user._id} (actual age: ${user.age})`);
    
    if (!phaseData[ageRange]) {
      throw new BadRequestException(`Invalid age range: ${ageRange}. Must be one of: ${Object.keys(phaseData).join(', ')}`);
    }

    try {
      // Load age scales from JSON file
      const scalesFilePath = path.join(__dirname, 'quiz-data', 'age-scales.json');
      const scalesFileContent = fs.readFileSync(scalesFilePath, 'utf8');
      const jsonAgeScales = JSON.parse(scalesFileContent);

      // Load predefined questions for the specific age range from JSON file
      const questionsFilePath = path.join(__dirname, 'quiz-data', `questions-${ageRange}.json`);
      const questionsFileContent = fs.readFileSync(questionsFilePath, 'utf8');
      const predefinedQuestions = JSON.parse(questionsFileContent);

      // Get the appropriate scale from the file
      const scale = jsonAgeScales[ageRange];
      
      if (!scale || !predefinedQuestions) {
        throw new BadRequestException('Failed to get questions for the specified age range');
      }
      
      this.logger.log(`Using predefined questions for signed-in user ${user._id} with age range ${ageRange} - ${predefinedQuestions.length} questions available`);
      
      // Format questions with their answer scales
      const formattedQuestions = predefinedQuestions.map(text => ({
        text,
        answers: scale
      }));

      // Structure the quiz with phases based on the predefined questions
      const { phases, funBreaks } = phaseData[ageRange];
      
      // Create phase structure
      const questionCount = formattedQuestions.length;
      const phaseSize = Math.ceil(questionCount / 3);
      
      const quizPhases = [];
      for (let i = 0; i < 3; i++) {
        const startIdx = i * phaseSize;
        const endIdx = Math.min(startIdx + phaseSize, questionCount);
        
        if (startIdx < questionCount) {
          quizPhases.push({
            name: phases[i],
            questions: formattedQuestions.slice(startIdx, endIdx),
            funBreak: funBreaks[i]
          });
        }
      }
      
      // Create structured quiz content
      const quizContent = {
        phases: quizPhases
      };
      
      // Validate quiz structure
      if (!quizContent.phases || !Array.isArray(quizContent.phases)) {
        this.logger.error(`Invalid quiz content format: ${JSON.stringify(quizContent)}`);
        throw new BadRequestException('Invalid quiz content format: phases array is missing or not an array');
      }

      // Validate each phase
      for (let i = 0; i < quizContent.phases.length; i++) {
        const phase = quizContent.phases[i];
        if (!phase.name || !phase.questions || !Array.isArray(phase.questions) || !phase.funBreak) {
          this.logger.error(`Invalid phase format at index ${i}: ${JSON.stringify(phase)}`);
          throw new BadRequestException(`Invalid phase format at index ${i}: missing name, funBreak, or questions array`);
        }
        
        // Validate questions and answers
        for (let j = 0; j < phase.questions.length; j++) {
          const question = phase.questions[j];
          if (!question.text || !question.answers || !Array.isArray(question.answers) || question.answers.length !== scale.length) {
            this.logger.error(`Invalid question format at phase ${i}, question ${j}: ${JSON.stringify(question)}`);
            throw new BadRequestException(`Invalid question format at phase ${i}, question ${j}: missing text or incorrect number of answers`);
          }
        }
      }

      // Flatten questions and collect fun breaks for database structure
      const flattenedQuestions = [];
      const allFunBreaks = [];
      
      quizContent.phases.forEach(phase => {
        allFunBreaks.push(phase.funBreak);
        phase.questions.forEach(question => {
          flattenedQuestions.push({
            text: question.text,
            answers: question.answers,
          });
        });
      });

      const quiz = await this.quizModel.create({
        user: user._id,
        ageRange,
        questions: flattenedQuestions,
        funBreaks: allFunBreaks,
        completed: false,
        userAnswers: [],
        analysis: '',
        // Store original phases structure for the frontend
        phasesData: quizContent.phases
      });

      return quiz;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error parsing quiz content: ${error.message}`, error.stack);
      throw new BadRequestException(`Error parsing quiz content: ${error.message}`);
    }
  }

  async getAllQuizzes(currentUser: User): Promise<CareerQuiz[]> {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    return await this.quizModel.find().populate('user').exec();
  }

  async analyzeAnswers(dto: SubmitAnswersDto): Promise<{
    analysis: any;
    quizId: string;
    userId: string;
    answers: { questionIndex: number; answer: string }[];
  }> {
    this.logger.log(`Analyzing answers for quiz ${dto.quizId}`);
    
    const quiz = await this.quizModel
      .findById(dto.quizId)
      .populate('user')
      .exec();
    
    if (!quiz) {
      this.logger.error(`Quiz not found in analyzeAnswers with ID: ${dto.quizId}`);
      throw new NotFoundException('Quiz not found');
    }

    this.logger.log(`Found quiz in analyzeAnswers: ${quiz._id.toString()}, user: ${quiz.user._id.toString()}`);

    if (!dto.answers || !Array.isArray(dto.answers)) {
      this.logger.error('Answers array is missing or invalid');
      throw new BadRequestException('Answers array is missing or invalid');
    }

    const answersText: string[] = [];

    for (const answer of dto.answers) {
      // The career quiz schema has been updated and no longer uses phases
      // So we'll just use the questions array at the top level
      const question = quiz.questions[answer.questionIndex];
      
      if (!question) {
        throw new BadRequestException(
          `Invalid question reference: questionIndex=${answer.questionIndex}`,
        );
      }

      answersText.push(`Question: ${question.text}\nAnswer: ${answer.answer}`);
    }

    // Enhanced prompt that includes the user's name for personalized recommendations
    const userObj = quiz.user as any;
    const userName = userObj && userObj.firstName ? userObj.firstName : 'the student';

    // Enhanced prompt that includes the user's name for personalized recommendations
    const prompt = `Given the following answers from a child named ${userName} (age range: ${quiz.ageRange}), provide a short, friendly profile and recommendations. 

${answersText.join('\n\n')}

Please provide:
1. Analysis of ${userName}'s interests and strengths
2. Potential career paths that align with their responses - list at least 5 specific careers (e.g. Software Developer, Marine Biologist, Graphic Designer)
3. Skills they should develop
4. Educational recommendations
5. Next steps for career exploration

IMPORTANT: For career paths, provide exactly 4-5 specific career options in a clear, bullet-point list format.
Format the career section like this:
"Potential career paths:
• Career 1
• Career 2
• Career 3
• Career 4
• Career 5"

Format your overall response in a clear, encouraging manner suitable for a curious student.
`.trim();

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = response.choices[0].message.content || '';
    this.logger.log(`Generated analysis for quiz ${dto.quizId}: ${analysis.substring(0, 100)}...`);

    quiz.userAnswers = dto.answers;
    quiz.completed = true;
    quiz.analysis = analysis;
    
    try {
      await quiz.save();
      this.logger.log(`Successfully saved quiz ${dto.quizId} with completed status and analysis`);
    } catch (error) {
      this.logger.error(`Error saving quiz ${dto.quizId}: ${error.message}`);
      throw new Error(`Failed to save quiz: ${error.message}`);
    }

    return {
      analysis,
      quizId: quiz._id.toString(),
      userId: quiz.user._id.toString(),
      answers: quiz.userAnswers,
    };
  }

  async submitAnswers(dto: SubmitAnswersDto, userId: string) {
    this.logger.log(`Attempting to submit answers for quiz ${dto.quizId} from user ${userId}`);
    
    const quiz = await this.quizModel
      .findById(dto.quizId)
      .populate('user')
      .exec();
    
    if (!quiz) {
      this.logger.error(`Quiz not found with ID: ${dto.quizId}`);
      throw new NotFoundException('Quiz not found');
    }

    this.logger.log(`Found quiz: ${quiz._id.toString()}, completed: ${quiz.completed}, user: ${quiz.user._id.toString()}`);

    if (quiz.user._id.toString() !== userId.toString()) {
      this.logger.error(`User ${userId} not authorized to submit answers for quiz ${dto.quizId} owned by ${quiz.user._id.toString()}`);
      throw new BadRequestException(
        'You are not authorized to submit answers for this quiz',
      );
    }

    if (quiz.completed) {
      this.logger.warn(`Quiz ${dto.quizId} is already completed`);
      throw new BadRequestException('Quiz already completed');
    }

    this.logger.log(
      `Received answers for quiz ${dto.quizId}: ${JSON.stringify(dto.answers)}`,
    );

    const result = await this.analyzeAnswers(dto);
    
    // Get the complete user information
    const user = await this.userModel.findById(result.userId)
      .select('-password')  // Exclude sensitive information
      .exec();

    try {
      // Award stars for quiz completion (quiz is already saved in analyzeAnswers)
      this.logger.log(`Awarding stars for quiz completion to user ${result.userId} for quiz ${dto.quizId}`);
      const awardedStar = await this.rewardsService.awardQuizCompletionStars(result.userId, dto.quizId);
      this.logger.log(`Successfully awarded stars for quiz ${dto.quizId}: ${JSON.stringify(awardedStar)}`);
      
      // Ensure the quiz is linked to the user
      await this.userModel.findByIdAndUpdate(
        result.userId,
        { 
          $addToSet: { quizzes: dto.quizId },
          initialQuizId: quiz._id  // Set as initial quiz if not set
        },
        { new: true }
      );
      
    } catch (error) {
      // Log the error but don't fail the whole operation
      this.logger.error(`Failed to award stars or update user: ${error.message}`);
    }
      
    // Include user details in the response
    this.logger.log(`Successfully analyzed answers for quiz ${dto.quizId}, completed: ${result.quizId}`);
    return {
      ...result,
      userId: undefined,  // Remove the userId field as we're including the full user object
      user: user          // Include the full user object
    };
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
    quizId?: string
  ): Promise<EducationalContent> {
    this.logger.log(`Generating educational content for user ${userId}${quizId ? ` with quizId ${quizId}` : ''}`);
    
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      this.logger.error(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }
    
    this.logger.log(`Found user: ${user._id}, age: ${user.age}, role: ${user.role}`);
    
    if (user.role !== UserRole.STUDENT) {
      this.logger.error(`User ${userId} role is ${user.role}, not STUDENT`);
      throw new BadRequestException('Only students can generate content');
    }

    let latestQuiz = null;
    
    try {
      // First try to get quiz directly from database if we have a quiz ID
      if (quizId) {
        this.logger.log(`Attempting direct lookup of quiz ${quizId} by ID`);
        try {
          latestQuiz = await this.quizModel.findById(quizId).exec();
          if (latestQuiz) {
            this.logger.log(`Direct lookup successful for quiz ${quizId}, completed: ${latestQuiz.completed}, has analysis: ${!!latestQuiz.analysis}`);
            
            // If quiz doesn't belong to user, log a warning but still use it
            if (latestQuiz.user.toString() !== userId.toString()) {
              this.logger.warn(`Quiz ${quizId} belongs to user ${latestQuiz.user}, not ${userId}, but proceeding anyway`);
            }
          } else {
            this.logger.warn(`Direct lookup failed, quiz ${quizId} not found`);
          }
        } catch (error) {
          this.logger.error(`Error in direct quiz lookup: ${error.message}`);
        }
      }
      
      // If direct lookup failed or no quizId provided, try getLatestQuiz
      if (!latestQuiz) {
        this.logger.log(`Falling back to getLatestQuiz method for user ${userId}${quizId ? ` with quizId ${quizId}` : ''}`);
        latestQuiz = await this.getLatestQuiz(userId, quizId);
      }
      
      if (!latestQuiz) {
        this.logger.warn(`No quiz found for user ${userId}${quizId ? ` with quizId ${quizId}` : ''}, but will still generate generic content`);
        // Continue without a quiz, we'll generate generic content instead of failing
      } else if (!latestQuiz.completed || !latestQuiz.analysis) {
        this.logger.warn(`Quiz ${latestQuiz._id} found but not completed or missing analysis. Completed: ${latestQuiz.completed}, Has analysis: ${!!latestQuiz.analysis}`);
        // Continue without analysis, we'll generate generic content
      }
    } catch (error) {
      this.logger.error(`Error finding quiz: ${error.message}`);
      throw new BadRequestException(`Unable to find quiz: ${error.message}`);
    }
    
    this.logger.log(`Using quiz ${latestQuiz._id} to generate educational content`);

    let prompt;
    
    if (latestQuiz && latestQuiz.completed && latestQuiz.analysis) {
      // If we have a completed quiz with analysis, use it
      prompt = `Generate personalized educational content for a ${user.age}-year-old child named ${user.firstName}.
    
Based on the quiz analysis: ${latestQuiz.analysis}, create a custom learning plan with:

1. Videos: Suggest 3-5 educational YouTube videos. Include title and URL.
2. Books: Suggest 3-5 FREE and OPEN SOURCE books that are completely free to access. Do not include any paid books or books that require purchase. Only suggest books from sources like Project Gutenberg, Open Library, or other free repositories. Include title, author, level, and educational theme.

Format your response as a JSON object with two keys:
- "video": array of {title, url} objects
- "books": array of {title, author, level, theme} objects - ONLY FREE AND OPEN SOURCE BOOKS`;
    } else {
      // If we don't have a completed quiz with analysis, generate generic content
      prompt = `Generate age-appropriate educational content for a ${user.age}-year-old child named ${user.firstName}.
      
Create a general learning plan with:

1. Videos: Suggest 3-5 educational YouTube videos about basic subjects like math, science, reading. Include title and URL.
2. Books: Suggest 3-5 FREE and OPEN SOURCE books that are completely free to access. Do not include any paid books or books that require purchase. Only suggest books from sources like Project Gutenberg, Open Library, or other free repositories. Include title, author, level, and educational theme.

Format your response as a JSON object with two keys:
- "video": array of {title, url} objects
- "books": array of {title, author, level, theme} objects - ONLY FREE AND OPEN SOURCE BOOKS

For example:
{
  "video": [
    {"title": "Introduction to Fractions", "url": "https://www.youtube.com/watch?v=example1"},
    {"title": "The Water Cycle", "url": "https://www.youtube.com/watch?v=example2"}
  ],
  "books": [
    {"title": "Alice's Adventures in Wonderland", "author": "Lewis Carroll", "level": "Intermediate", "theme": "Imagination"},
    {"title": "The Wonderful Wizard of Oz", "author": "L. Frank Baum", "level": "Intermediate", "theme": "Adventure"}
  ]
}`;
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const JsonEducationContent = JSON.parse(
      response.choices[0].message.content || '{}',
    );

    try {
      // Verify we have content before creating
      if (!JsonEducationContent.video || !JsonEducationContent.books || 
          (!JsonEducationContent.video.length && !JsonEducationContent.books.length)) {
        this.logger.warn('AI response did not contain expected video or book content, using fallback content');
        
        // Create fallback content
        const fallbackContent = {
          user: user._id,
          videoUrl: [
            { 
              title: "Introduction to Math for Kids", 
              url: "https://www.youtube.com/watch?v=aUJ-4oD9Oe8" 
            },
            { 
              title: "Basic Science Concepts for Kids", 
              url: "https://www.youtube.com/watch?v=6ybBuTETr3U" 
            }
          ],
          books: [
            { 
              title: "A Child's Garden of Verses", 
              author: "Robert Louis Stevenson", 
              level: "Elementary",
              theme: "Poetry"
            },
            { 
              title: "The Wonderful Wizard of Oz", 
              author: "L. Frank Baum", 
              level: "Elementary",
              theme: "Adventure"
            }
          ],
          games: [
            { 
              name: "PBS Kids Games", 
              url: "https://pbskids.org/games", 
              skill: "Various" 
            }
          ]
        };
        
        // Save the fallback content
        const savedFallbackContent = await this.eduContentModel.create(fallbackContent);
        
        // Update the user to reference this content
        await this.userModel.findByIdAndUpdate(
          user._id,
          { $addToSet: { educationalContents: savedFallbackContent._id } }
        );
        
        return savedFallbackContent;
      }
      
      // Create with AI-generated content
      const educationalContent = await this.eduContentModel.create({
        user: user._id,
        videoUrl: JsonEducationContent.video || [],
        books: JsonEducationContent.books || [],
        games: JsonEducationContent.games || [] // Include games if available
      });
      
      // Update the user to reference this content
      await this.userModel.findByIdAndUpdate(
        user._id,
        { $addToSet: { educationalContents: educationalContent._id } }
      );
      
      return educationalContent;
    } catch (error) {
      this.logger.error('Error creating educational content: ' + error.message, error.stack);
      
      // If there was an error, return a minimal content object
      return await this.eduContentModel.create({
        user: user._id,
        videoUrl: [{ title: "Learning Basics", url: "https://www.youtube.com/watch?v=RMJHbm5LfKU" }],
        books: [],
        games: []
      });
    }
  }

  private async getLatestQuiz(userId: string, quizId?: string): Promise<CareerQuiz | null> {
    this.logger.log('Getting quiz for user ' + userId + (quizId ? ' with quizId ' + quizId : ''));
    
    // If quizId is provided, try to find that specific quiz first
    if (quizId) {
      try {
        // First, try to find by exact ID match without user filtering
        const specificQuiz = await this.quizModel
          .findById(quizId)
          .exec();
        
        if (specificQuiz) {
          this.logger.log('Found quiz with ID ' + quizId + ', owned by user ' + specificQuiz.user + ', requesting user: ' + userId);
          
          // Check if it belongs to the user
          if (specificQuiz.user.toString() === userId.toString()) {
            this.logger.log('Quiz ' + quizId + ' belongs to user ' + userId + ', completed: ' + specificQuiz.completed + ', has analysis: ' + !!specificQuiz.analysis);
            return specificQuiz;
          } else {
            this.logger.warn('Quiz ' + quizId + ' found but belongs to user ' + specificQuiz.user + ', not ' + userId);
          }
        } else {
          this.logger.warn('No quiz found with ID ' + quizId);
        }
      } catch (error) {
        this.logger.error(`Error finding quiz by ID ${quizId}: ${error.message}`);
      }
    }
    
    // Fall back to the latest quiz with analysis
    try {
      const latestQuiz = await this.quizModel
        .findOne({ user: userId, completed: true })
        .sort({ updatedAt: -1 })
        .exec();
      
      if (latestQuiz) {
        this.logger.log(`Found latest quiz: ${latestQuiz._id}, completed: ${latestQuiz.completed}, has analysis: ${!!latestQuiz.analysis}`);
        return latestQuiz;
      } else {
        this.logger.warn(`No completed quizzes found for user ${userId}`);
        
        // As a last resort, look for any quiz for this user
        const anyQuiz = await this.quizModel
          .findOne({ user: userId })
          .sort({ updatedAt: -1 })
          .exec();
          
        if (anyQuiz) {
          this.logger.log(`Found non-completed quiz: ${anyQuiz._id}, completed: ${anyQuiz.completed}, has analysis: ${!!anyQuiz.analysis}`);
          return anyQuiz;
        }
        
        this.logger.warn(`No quizzes at all found for user ${userId}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error finding latest quiz: ${error.message}`);
      return null;
    }
  }

  /**
   * Get the raw quiz analysis for debugging purposes
   */
  async getQuizAnalysis(userId: string, quizId?: string) {
    try {
      const quiz = await this.getLatestQuiz(userId, quizId);
      
      if (!quiz) {
        throw new BadRequestException('No quiz found');
      }
      
      return {
        quizId: quiz._id.toString(),
        analysis: quiz.analysis || 'No analysis available',
        completed: quiz.completed,
        updatedAt: (quiz as any).updatedAt || new Date()
      };
    } catch (error) {
      this.logger.error(`Error getting quiz analysis: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Unable to get quiz analysis: ${error.message}`);
    }
  }
  
  /**
   * Special extractor for career recommendations when they don't have percentages
   * This helps with the newer AI responses that don't follow the expected format
   */
  private extractCareerSection(analysis: string): Array<{career: string, matchPercentage: number, emoji: string}> {
    const careers = [];
    const careerEmojis = ['👩‍💻', '🧑‍🔬', '👨‍🏫', '👩‍🎨', '🧑‍⚕️', '🧑‍🔧', '👨‍💼', '👩‍✈️', '👨‍🚀', '🧑‍🍳'];
    
    try {
      // Look for a section with career recommendations
      let careerParagraph = '';
      
      // First look for a section explicitly about careers
      const careerSectionMatch = analysis.match(/(?:Potential career paths|Career recommendations|Career options)[\s\S]*?(?:\d\.|Next steps|$)/i);
      if (careerSectionMatch) {
        careerParagraph = careerSectionMatch[0];
      } else {
        // Try to find any section mentioning careers
        const paragraphs = analysis.split('\n\n');
        for (const paragraph of paragraphs) {
          if (paragraph.toLowerCase().includes('career') || 
              paragraph.toLowerCase().includes('profession') || 
              paragraph.toLowerCase().includes('occupation')) {
            careerParagraph = paragraph;
            break;
          }
        }
      }
      
      if (careerParagraph) {
        // Try to extract individual career names
        let careerList: string[] = [];
        
        // Check for numbered or bulleted list
        const listItems = careerParagraph.match(/(?:^|\n)(?:\d+\.|[-•*])\s*(.*?)(?=(?:\n(?:\d+\.|[-•*]))|$)/gm);
        
        if (listItems && listItems.length > 0) {
          // Extract career names from list items
          careerList = listItems.map(item => {
            // Remove the bullet/number and trim
            return item.replace(/(?:^|\n)(?:\d+\.|[-•*])\s*/, '').trim();
          });
        } else {
          // If no list formatting, split by commas and "and"
          careerParagraph = careerParagraph.replace(/(?:Potential career paths|Career recommendations|Career options)[^\w]*:?/i, '');
          careerList = careerParagraph.split(/(?:,|\sand\s)/i)
            .map(c => c.trim())
            .filter(c => c.length > 0 && c.length < 50); // Filter out very long phrases which are likely paragraphs
        }
        
        // Add each career with a random emoji and match percentage
        let index = 0;
        for (const career of careerList) {
          // Skip if it's not a career (too short or contains specific non-career terms)
          if (career.length < 3 || 
              /\b(you|should|next|step|include|recommend|skill)\b/i.test(career)) {
            continue;
          }
          
          // Get a random emoji from the career emoji list
          const emoji = careerEmojis[index % careerEmojis.length];
          
          // Generate a match percentage between 75-98%
          // Start with higher percentages for first items in the list
          const basePercentage = 98 - (index * 3);
          const matchPercentage = Math.max(75, Math.min(98, basePercentage));
          
          careers.push({
            career,
            emoji,
            matchPercentage
          });
          
          index++;
        }
      }
      
      return careers;
    } catch (error) {
      this.logger.warn(`Error in special career extraction: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get career recommendations from a user's quiz analysis
   * This extracts the career recommendations and their match percentages
   * from the AI-generated analysis text
   */
  async getCareerRecommendations(userId: string, quizId?: string) {
    try {
      this.logger.log(`Getting career recommendations for user ${userId}${quizId ? ` with quizId ${quizId}` : ''}`);
      
      // Find the latest completed quiz with analysis
      const quiz = await this.getLatestQuiz(userId, quizId);
      
      if (!quiz || !quiz.completed || !quiz.analysis) {
        this.logger.warn(`No completed quiz with analysis found for user ${userId}${quizId ? ` with quizId ${quizId}` : ''}`);
        throw new BadRequestException('No completed quiz found. Please complete a career assessment quiz first.');
      }
      
      // Log a sample of the analysis for debugging
      this.logger.debug(`Quiz analysis sample (first 200 chars): ${quiz.analysis.substring(0, 200)}`);
      this.logger.debug(`Analysis length: ${quiz.analysis.length} characters`);
      
      // Parse the analysis to extract personality traits and career recommendations
      const traits = this.extractPersonalityTraits(quiz.analysis);
      const careers = this.extractCareerRecommendations(quiz.analysis);
      
      this.logger.log(`Extracted ${traits.length} traits and ${careers.length} career recommendations`);
      
      // If careers are empty, try our special career extractor
      if (careers.length === 0) {
        this.logger.log('No careers found with standard extraction, trying special career extractor');
        const specialCareers = this.extractCareerSection(quiz.analysis);
        if (specialCareers.length > 0) {
          this.logger.log(`Found ${specialCareers.length} careers with special extractor`);
          careers.push(...specialCareers);
        }
      }
      
      // If both are still empty, log more details about the analysis
      if (traits.length === 0 && careers.length === 0) {
        this.logger.warn('Failed to extract any traits or careers. Analysis format may be unexpected.');
        this.logger.debug(`Analysis format check: Contains newlines: ${quiz.analysis.includes('\n')}`);
        this.logger.debug(`Analysis format check: Contains emojis: ${/[^\w\s]/.test(quiz.analysis)}`);
        this.logger.debug(`Analysis format check: Contains percentages: ${quiz.analysis.includes('%')}`);
        
        // Try a simple fallback extraction as a last resort
        const fallbackResults = this.simpleFallbackExtraction(quiz.analysis);
        traits.push(...fallbackResults.traits);
        careers.push(...fallbackResults.careers);
      }
      
      return {
        traits,
        careers,
        quizId: quiz._id.toString(),
        completedAt: new Date()
      };
    } catch (error) {
      this.logger.error(`Error getting career recommendations: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Unable to get career recommendations: ${error.message}`);
    }
  }
  
  /**
   * Extract personality traits from the quiz analysis
   */
  private extractPersonalityTraits(analysis: string): Array<{trait: string, description: string, emoji: string}> {
    // Initialize with empty array in case we can't extract traits
    const traits = [];
    
    try {
      // Look for personality traits in the analysis text
      // Common patterns in the analysis text based on the UI example
      const traitRegex = /(🎨|🔬|👥|🧠|🌟|🔍|🚀|🌱|🎭|📚|✏️|💡)\s*([\w\s]+)\s*([\w\s,!]+)/g;
      
      let match;
      while ((match = traitRegex.exec(analysis)) !== null) {
        traits.push({
          emoji: match[1],
          trait: match[2].trim(),
          description: match[3].trim()
        });
      }
      
      // If regex didn't find anything, try to extract sections manually
      if (traits.length === 0) {
        // Split by double newlines and look for emoji + text patterns
        const sections = analysis.split('\n\n');
        for (const section of sections) {
          // If section starts with emoji and doesn't contain "Career" (to avoid capturing career recommendations)
          if (/^[^\w\s]/.test(section) && !section.includes("Career")) {
            const lines = section.split('\n');
            if (lines.length >= 2) {
              const emoji = lines[0].trim().charAt(0);
              const trait = lines[0].trim().substring(1).trim();
              const description = lines.slice(1).join(' ').trim();
              
              traits.push({ emoji, trait, description });
            }
          }
        }
      }
      
      return traits;
    } catch (error) {
      this.logger.warn(`Error extracting personality traits: ${error.message}`);
      return traits; // Return empty array if extraction fails
    }
  }
  
  /**
   * Extract career recommendations from the quiz analysis
   */
  private extractCareerRecommendations(analysis: string): Array<{career: string, matchPercentage: number, emoji: string}> {
    // Initialize with empty array in case we can't extract careers
    const careers = [];
    
    try {
      // Look for career recommendations in the analysis text
      // Format based on the UI example: "Artist - 98% Match"
      const careerRegex = /(🎨|🔬|👩‍🏫|👨‍💻|🧑‍🔬|🧑‍🎨|🧑‍⚕️|🧑‍🚒|🧑‍🔧|🧑‍💼|✈️)\s*([\w\s]+)\s*(?:-)?([\d]+)%\s*Match/gi;
      
      let match;
      while ((match = careerRegex.exec(analysis)) !== null) {
        careers.push({
          emoji: match[1],
          career: match[2].trim(),
          matchPercentage: parseInt(match[3], 10)
        });
      }
      
      // If regex didn't find anything, try to extract career sections manually
      if (careers.length === 0) {
        // Look for a section that mentions careers
        const sections = analysis.split('\n\n');
        let careerSection = '';
        
        for (const section of sections) {
          if (section.toLowerCase().includes('career') || section.toLowerCase().includes('match')) {
            careerSection = section;
            break;
          }
        }
        
        if (careerSection) {
          const careerLines = careerSection.split('\n');
          for (const line of careerLines) {
            // Try to extract career and percentage
            const basicMatch = line.match(/([\w\s]+)\s*-?\s*([\d]+)%/i);
            if (basicMatch) {
              // Try to find an emoji
              const emoji = line.match(/([^\w\s])/)?.[1] || '🌟';
              
              careers.push({
                emoji,
                career: basicMatch[1].trim(),
                matchPercentage: parseInt(basicMatch[2], 10)
              });
            }
          }
        }
      }
      
      // Sort by match percentage (highest first)
      return careers.sort((a, b) => b.matchPercentage - a.matchPercentage);
    } catch (error) {
      this.logger.warn(`Error extracting career recommendations: ${error.message}`);
      return careers; // Return empty array if extraction fails
    }
  }
  
  /**
   * Simple fallback extraction for when regular expressions fail
   * This uses a more aggressive approach to find any content that looks like traits or careers
   */
  private simpleFallbackExtraction(analysis: string) {
    const result = {
      traits: [],
      careers: []
    };
    
    try {
      // First, let's see if we can extract specific career recommendations
      const careerSection = this.extractCareerSection(analysis);
      if (careerSection && careerSection.length > 0) {
        result.careers = careerSection;
      }
      
      // If no careers were found using the special extractor, try the old method
      if (result.careers.length === 0) {
        // Split by any combination of newlines or multiple spaces
        const lines = analysis.split(/[\n\s]{2,}/);
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines
          if (!trimmedLine) continue;
          
          // Look for percentage matches which likely indicate careers
          if (trimmedLine.includes('%')) {
            // Attempt to extract a career and percentage
            const parts = trimmedLine.split(/[-–]/); // Handle different dash types
            
            if (parts.length >= 1) {
              // The career name should be in the first part
              const careerName = parts[0].trim();
              
              // Try to extract a percentage from any part
              let matchPercentage = 0;
              for (const part of parts) {
                const percentMatch = part.match(/([\d]+)%/);
                if (percentMatch) {
                  matchPercentage = parseInt(percentMatch[1], 10);
                  break;
                }
              }
              
              // Only add if we have both a career name and a percentage
              if (careerName && matchPercentage > 0) {
                // Try to find an emoji at the start
                const emoji = /^[^\w\s]/.test(careerName) ? careerName.charAt(0) : '🌟';
                
                // Clean the career name if it starts with an emoji
                const cleanCareerName = /^[^\w\s]/.test(careerName) 
                  ? careerName.substring(1).trim() 
                  : careerName;
                
                result.careers.push({
                  emoji,
                  career: cleanCareerName,
                  matchPercentage
                });
              }
            }
          }
          // If the line has at least 15 characters and doesn't have a percentage, it might be a trait
          else if (trimmedLine.length > 15 && !trimmedLine.toLowerCase().includes('career')) {
            // Try to find an emoji at the start
            const emoji = /^[^\w\s]/.test(trimmedLine) ? trimmedLine.charAt(0) : '🧠';
            
            // Extract the trait name (first few words)
            const words = trimmedLine.split(' ');
            let traitName = '';
            let description = '';
            
            if (words.length > 3) {
              // Use first 2-3 words as the trait name
              traitName = words.slice(0, 3).join(' ');
              // Rest is the description
              description = words.slice(3).join(' ');
            } else {
              // If very short, just use it as a trait name
              traitName = trimmedLine;
              description = 'This is one of your personality traits.';
            }
            
            // Clean the trait name if it starts with an emoji
            const cleanTraitName = /^[^\w\s]/.test(traitName) 
              ? traitName.substring(1).trim() 
              : traitName;
            
            result.traits.push({
              emoji,
              trait: cleanTraitName,
              description
            });
          }
        }
      }
      
      // Sort careers by match percentage
      result.careers.sort((a, b) => b.matchPercentage - a.matchPercentage);
      
      // Limit to reasonable numbers
      result.traits = result.traits.slice(0, 5);
      result.careers = result.careers.slice(0, 5);
      
      return result;
    } catch (error) {
      this.logger.error(`Error in fallback extraction: ${error.message}`);
      return result; // Return empty arrays if fallback fails
    }
  }

  // The rest of the implementation remains unchanged
  // ... (additional methods like submitAnswers, generateProfileOutcome, etc.)
}