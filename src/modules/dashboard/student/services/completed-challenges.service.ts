import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LoggerService } from 'src/common/logger/logger.service';
import { 
  Challenge, 
  CompletedChallenge, 
  CompletedChallengeDocument,
  ChallengeDocument
} from 'src/modules/schemas';
import { RewardsService } from 'src/modules/rewards/rewards.service';

@Injectable()
export class CompletedChallengesService {
  constructor(
    @InjectModel(CompletedChallenge.name)
    private completedChallengeModel: Model<CompletedChallengeDocument>,
    @InjectModel(Challenge.name)
    private challengeModel: Model<ChallengeDocument>,
    private readonly rewardsService: RewardsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('CompletedChallengesService');
  }

  async getCompletedChallenges(userId: string) {
    try {
      const completedChallenges = await this.completedChallengeModel
        .find({ userId })
        .populate('challengeId')
        .exec();

      return completedChallenges;
    } catch (error) {
      this.logger.error(
        `Error getting completed challenges: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async checkChallengeCompletion(userId: string, challengeId: string) {
    try {
      const completedChallenge = await this.completedChallengeModel
        .findOne({ userId, challengeId })
        .exec();
      
      return !!completedChallenge;
    } catch (error) {
      this.logger.error(
        `Error checking challenge completion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async completeChallenge(userId: string, challengeId: string, completionNotes?: string, workFileUrl?: string) {
    try {
      // Check if challenge exists
      const challenge = await this.challengeModel.findById(challengeId).exec();
      if (!challenge) {
        throw new NotFoundException('Challenge not found');
      }

      // Check if already completed
      const existingCompletion = await this.completedChallengeModel
        .findOne({ userId, challengeId })
        .exec();
      
      if (existingCompletion) {
        throw new ConflictException('Challenge already completed by this user');
      }

      // Create completion record
      const completedChallenge = new this.completedChallengeModel({
        userId,
        challengeId,
        completionNotes,
        workFileUrl,
        completedAt: new Date(),
      });
      await completedChallenge.save();

      // Award badge and stars for challenge completion
      const badge = await this.rewardsService.completeChallenge(userId, challengeId, completionNotes, workFileUrl);

      return {
        message: 'Challenge completed successfully',
        challenge,
        badge
      };
    } catch (error) {
      this.logger.error(
        `Error completing challenge: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}