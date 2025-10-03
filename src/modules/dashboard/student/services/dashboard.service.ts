import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, CareerQuiz, EducationalContent } from 'src/modules/schemas';
import { LoggerService } from 'src/common/logger/logger.service';
import { AiService } from 'src/modules/ai/ai.service';
import { RewardsService } from 'src/modules/rewards/rewards.service';
import { DashboardResponse } from 'src/common/interfaces';

@Injectable()
export class StudentDashboardService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(CareerQuiz.name)
    private readonly quizModel: Model<CareerQuiz>,
    @InjectModel(EducationalContent.name)
    private readonly eduContentModel: Model<EducationalContent>,
    private readonly logger: LoggerService,
    private readonly aiService: AiService,
    private readonly rewardsService: RewardsService,
  ) {}

  async getDashboardData(student: User): Promise<{
    dashboardResponse: DashboardResponse;
  }> {
    const completeUserData = await this.userModel.findById(student._id).exec();

    // Get quiz status, recommendations, and rewards for this user - use completeUserData
    const [quizStatus, recommendations, badges, stars] = await Promise.all([
      this.getQuizStatusForUser(completeUserData || student),
      this.getRecommendations(completeUserData || student),
      this.rewardsService.getBadgesForUser(student._id.toString()),
      this.rewardsService.getStarsForUser(student._id.toString())
    ]);

    // Calculate summary statistics
    // Count completed quizzes based on actual quiz completion status
    const summary = {
      totalBadges: badges.length,
      completedQuizzes: quizStatus.isCompleted ? 1 : 0, // Use actual quiz completion status
      totalStars: stars.reduce((total, star) => total + (star.starValue || 0), 0)
    };

    return {
      dashboardResponse: {
        success: true,
        message: 'Student dashboard data retrieved successfully',
        timestamp: new Date().toISOString(),
        userId: student._id.toString(),
        quizStatus: {
          hasQuiz: quizStatus.hasQuiz,
          isCompleted: quizStatus.isCompleted,
          needsToTakeQuiz: !quizStatus.hasQuiz || !quizStatus.isCompleted
        },
        educationalContents: recommendations || [],
        badges: badges || [],
        stars: stars || [], // Adding stars to the response
        summary: summary,
        currentUser: completeUserData || student,
      },
    };
  }

  async getInitialQuiz(student: User): Promise<CareerQuiz | null> {
    // Check if student has an initial quiz assigned
    if (!student.initialQuizId) {
      return null;
    }

    // Get the quiz details
    const quiz = await this.quizModel.findById(student.initialQuizId);
    if (!quiz) {
      this.logger.warn(
        `Initial quiz ${student.initialQuizId} not found for student ${student._id}`,
      );
      return null;
    }

    return quiz;
  }
  
  async getQuizStatusForUser(student: User): Promise<{
    hasQuiz: boolean;
    isCompleted: boolean;
    quiz?: CareerQuiz;
  }> {
    let quiz: CareerQuiz | null = null;
    
    // Debug: Log student object details
    this.logger.log(`🔍 Checking quiz status for student ${student._id}`);
    this.logger.log(`📊 Student object keys: ${Object.keys(student).join(', ')}`);
    this.logger.log(`🎯 initialQuizId: ${(student as any).initialQuizId}`);
    this.logger.log(`📋 quizzes array: ${JSON.stringify((student as any).quizzes)}`);
    
    // First, try to find quiz using initialQuizId if it exists
    if ((student as any).initialQuizId) {
      this.logger.log(`🔎 Searching by initialQuizId: ${(student as any).initialQuizId}`);
      quiz = await this.quizModel.findById((student as any).initialQuizId).exec();
      this.logger.log(`📋 Quiz found by initialQuizId: ${!!quiz}`);
      if (quiz) {
        this.logger.log(`✅ Quiz details: ID=${quiz._id}, completed=${quiz.completed}, user=${quiz.user}`);
      }
    }
    
    // If no quiz found by initialQuizId, try to find by user ID
    if (!quiz) {
      this.logger.log(`🔎 Searching by user ID: ${student._id}`);
      quiz = await this.quizModel.findOne({ 
        user: student._id 
      }).sort({ createdAt: -1 }).exec();
      this.logger.log(`📋 Quiz found by user ID: ${!!quiz}`);
      if (quiz) {
        this.logger.log(`✅ Quiz details: ID=${quiz._id}, completed=${quiz.completed}, user=${quiz.user}`);
      }
    }
    
    // If still no quiz, try searching with quizzes array
    if (!quiz && (student as any).quizzes && (student as any).quizzes.length > 0) {
      const latestQuizId = (student as any).quizzes[(student as any).quizzes.length - 1];
      this.logger.log(`🔎 Searching by quizzes array, latest quiz ID: ${latestQuizId}`);
      quiz = await this.quizModel.findById(latestQuizId).exec();
      this.logger.log(`📋 Quiz found by quizzes array: ${!!quiz}`);
      if (quiz) {
        this.logger.log(`✅ Quiz details: ID=${quiz._id}, completed=${quiz.completed}, user=${quiz.user}`);
      }
    }
    
    if (!quiz) {
      this.logger.log(`❌ No career quiz found for student ${student._id}`);
      
      // Debug: Check all quizzes in database
      const allQuizzes = await this.quizModel.find({}).limit(3).exec();
      this.logger.log(`🗄️ Total quizzes in DB: ${allQuizzes.length}`);
      allQuizzes.forEach((q, index) => {
        this.logger.log(`📝 Quiz ${index + 1}: ID=${q._id}, user=${q.user}, completed=${q.completed}`);
      });
      
      return {
        hasQuiz: false,
        isCompleted: false
      };
    }
    
    this.logger.log(`✅ Found career quiz ${quiz._id} for student ${student._id}, completed: ${quiz.completed}`);
    
    return {
      hasQuiz: true,
      isCompleted: quiz.completed,
      quiz: quiz
    };
  }

  async getAllQuizzesForUser(student: User): Promise<CareerQuiz[]> {
    // Find all quizzes for this user
    const quizzes = await this.quizModel.find({ 
      user: student._id 
    }).sort({ createdAt: -1 }).exec();
    
    this.logger.log(`Found ${quizzes.length} quizzes for student ${student._id}`);
    
    return quizzes;
  }

  async submitQuizAnswers(
    student: User,
    quizId: string,
    answers: { phaseIndex: number; questionIndex: number; answer: string }[],
  ) {
    // Use AI service to submit and analyze answers
    const result = await this.aiService.submitAnswers(
      { quizId, answers },
      student._id.toString(),
    );

    // Generate recommendations based on quiz results
    await this.generateRecommendations(student);

    return result;
  }

  async generateRecommendations(student: User) {
    try {
      this.logger.log(`Generating educational recommendations for student ${student._id}`);
      
      // Generate new educational content recommendations
      const newContent = await this.aiService.generateEducationalContent(
        student._id.toString(),
      );
      
      this.logger.log(`Received content from AI service: ${JSON.stringify(newContent)}`);

      // If no content was generated, create some default content
      if (!newContent || 
          (!newContent.videoUrl?.length && !newContent.books?.length && !newContent.games?.length)) {
        
        this.logger.log(`Creating default educational content for student ${student._id}`);
        
        // Create default educational content
        const defaultContent = {
          videoUrl: [
            { 
              title: "Introduction to Programming with Scratch", 
              url: "https://www.youtube.com/watch?v=jXUZaf5D12A" 
            },
            { 
              title: "Simple Science Experiments for Kids", 
              url: "https://www.youtube.com/watch?v=4MHn9Q5NtdY" 
            }
          ],
          books: [
            { 
              title: "Hello Ruby: Adventures in Coding", 
              author: "Linda Liukas", 
              level: "Beginner",
              theme: "Programming"
            }
          ],
          games: [
            { 
              name: "CodeCombat", 
              url: "https://codecombat.com/", 
              skill: "Programming" 
            }
          ],
          user: student._id
        };
        
        // Save the default content
        return await this.eduContentModel.create(defaultContent);
      }

      // Save the AI-generated content
      const savedContent = await this.eduContentModel.create({
        ...newContent,
        user: student._id,
      });
      
      this.logger.log(`Saved new educational content with ID: ${savedContent._id}`);
      
      // Update the user to link to this educational content
      await this.userModel.findByIdAndUpdate(
        student._id,
        { $addToSet: { educationalContents: savedContent._id } },
        { new: true }
      );
      
      return savedContent;
    } catch (error) {
      this.logger.warn(
        `Unable to generate recommendations for student ${student._id}: ${error.message}`,
        error.stack
      );
      
      // Instead of returning null, create a comprehensive default content
      try {
        const basicDefaultContent = {
          videoUrl: [
            { 
              title: "Basic Programming Concepts", 
              url: "https://www.youtube.com/watch?v=XASY30EfGAc" 
            },
            { 
              title: "Fun Math Games for Kids", 
              url: "https://www.youtube.com/watch?v=DnFrOetuUKg" 
            },
            { 
              title: "Science Experiments for Children", 
              url: "https://www.youtube.com/watch?v=4MHn9Q5NtdY" 
            }
          ],
          books: [
            { 
              title: "The Secret Garden", 
              author: "Frances Hodgson Burnett", 
              level: "Intermediate",
              theme: "Fiction" 
            },
            { 
              title: "Alice's Adventures in Wonderland", 
              author: "Lewis Carroll", 
              level: "Intermediate",
              theme: "Adventure" 
            }
          ],
          games: [
            { 
              name: "Scratch Junior", 
              url: "https://www.scratchjr.org/", 
              skill: "Programming" 
            },
            { 
              name: "PBS Kids Games", 
              url: "https://pbskids.org/games/", 
              skill: "Various" 
            }
          ],
          user: student._id
        };
        
        return await this.eduContentModel.create(basicDefaultContent);
      } catch (fallbackError) {
        this.logger.error(
          `Failed to create fallback content: ${fallbackError.message}`,
          fallbackError.stack
        );
        return null;
      }
    }
  }

  async getRecommendations(student: User) {
    // Get existing recommendations or generate new ones
    let content = await this.eduContentModel
      .find({ user: student._id })
      .sort({ createdAt: -1 });

    this.logger.log('Found ' + content.length + ' educational content items for student ' + student._id);

    if (!content.length) {
      const newRec = await this.generateRecommendations(student);
      content = newRec ? [newRec] : [];
      this.logger.log('Generated new educational content for student ' + student._id);
    } else {
      // Ensure we're getting all educational content that has proper data
      // Check if the first item has minimal content and if there are multiple items
      if (content.length > 1 && 
          (!content[0].books || content[0].books.length === 0) &&
          (!content[0].games || content[0].games.length === 0) && 
          (!content[0].videoUrl || content[0].videoUrl.length < 2)) {
        
        // If the latest content is minimal and older content exists, try to merge them
        this.logger.log('Merging educational content for student ' + student._id);
        
        // Find the most comprehensive content
        let bestContent = content[0];
        for (const item of content) {
          // Count the total elements across all content types
          const totalElements = 
            (item.videoUrl?.length || 0) + 
            (item.books?.length || 0) + 
            (item.games?.length || 0);
          
          const bestTotalElements = 
            (bestContent.videoUrl?.length || 0) + 
            (bestContent.books?.length || 0) + 
            (bestContent.games?.length || 0);
          
          if (totalElements > bestTotalElements) {
            bestContent = item;
          }
        }
        
        // Return the most comprehensive content
        return [bestContent];
      }
    }

    return content;
  }

  async getEducationalContent(
    contentId: string,
  ): Promise<EducationalContent | null> {
    return this.eduContentModel.findById(contentId).exec();
  }
}
