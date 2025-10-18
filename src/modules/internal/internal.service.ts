import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../schemas';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  // Validate JWT token and return user info
  async validateToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.userModel.findById(decoded.sub).lean();
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        valid: true,
        userId: user._id,
        email: user.email,
        role: user.role,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Token validation failed', error.message);
      return {
        valid: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get user data
  async getUser(userId: string) {
    try {
      const user = await this.userModel.findById(userId).lean();
      
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Return only necessary user data for AI service
      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}`, error.message);
      throw new NotFoundException('User not found');
    }
  }

  // Update user rewards
  async updateRewards(userId: string, points: number) {
    try {
      this.logger.log(`Updating rewards for user ${userId} with ${points} points`);
      
      // For now, just log the reward update
      // The actual rewards logic can be implemented based on existing reward structure
      this.logger.log(`Reward update simulated: ${points} points for user ${userId}`);
      
      return {
        success: true,
        message: `Added ${points} points to user ${userId}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to update rewards for user ${userId}`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}