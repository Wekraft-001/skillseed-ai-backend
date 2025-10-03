import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Badge,
  BadgeDocument,
  Star,
  StarDocument,
  Challenge,
  ChallengeDocument,
  EducationalContent,
  EducationalContentDocument,
  BadgeTier,
  Category,
  CategoryDocument,
  CompletedChallenge,
  CompletedChallengeDocument,
} from '../schemas';

@Injectable()
export class RewardsService {
  constructor(
    @InjectModel(Badge.name) private badgeModel: Model<BadgeDocument>,
    @InjectModel(Star.name) private starModel: Model<StarDocument>,
    @InjectModel(Challenge.name)
    private challengeModel: Model<ChallengeDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(EducationalContent.name)
    private educationalContentModel: Model<EducationalContentDocument>,
    @InjectModel(CompletedChallenge.name)
    private completedChallengeModel: Model<CompletedChallengeDocument>,
  ) {}

  async getStarsForUser(userId: string): Promise<Star[]> {
    return this.starModel.find({ user: userId }).exec();
  }

  async getBadgesForUser(userId: string): Promise<Badge[]> {
    return this.badgeModel.find({ user: userId }).exec();
  }

  async completeEducationalContent(
    userId: string,
    educationalContentId: string,
    contentType: 'video' | 'book' | 'game',
    contentIndex: number,
  ): Promise<Star> {
    // Find the educational content
    const educationalContent = await this.educationalContentModel
      .findById(educationalContentId)
      .exec();

    if (!educationalContent) {
      throw new NotFoundException('Educational content not found');
    }

    // Determine the title based on content type
    let title = '';
    let contentId = contentIndex.toString();

    if (contentType === 'video' && educationalContent.videoUrl[contentIndex]) {
      title = educationalContent.videoUrl[contentIndex].title;
    } else if (
      contentType === 'book' &&
      educationalContent.books[contentIndex]
    ) {
      title = educationalContent.books[contentIndex].title;
    } else if (
      contentType === 'game' &&
      educationalContent.games[contentIndex]
    ) {
      title = educationalContent.games[contentIndex].name;
    } else {
      throw new NotFoundException(
        `${contentType} at index ${contentIndex} not found`,
      );
    }

    // Get star value based on content type
    let starValue = 1; // Default value
    if (contentType === 'video') {
      starValue = 1; // 1 star per video
    } else if (contentType === 'book') {
      starValue = 20; // 20 stars per book
    } else if (contentType === 'game') {
      starValue = 1; // Default for games (not specified in requirements)
    }

    // Check if star already exists
    let star = await this.starModel
      .findOne({
        user: userId,
        educationalContent: educationalContentId,
        contentType,
        contentId,
      })
      .exec();

    if (star) {
      // Update existing star
      star.completed = true;
      star.completedAt = new Date();
      star.starValue = starValue; // Update star value
      await star.save();
    } else {
      // Create new star
      star = new this.starModel({
        user: userId,
        educationalContent: educationalContentId,
        contentType,
        contentId,
        title,
        completed: true,
        completedAt: new Date(),
        starValue: starValue, // Set star value
      });
      await star.save();
    }

    // Check for tier badges based on total stars
    await this.checkAndAwardTierBadges(userId);

    return star;
  }

  async completeChallenge(
    userId: string, 
    challengeId: string, 
    completionNotes?: string,
    workFileUrl?: string
  ): Promise<Badge> {
    // Find the challenge
    const challenge = await this.challengeModel
      .findById(challengeId)
      .populate('categoryId')
      .exec();

    if (!challenge) {
      throw new NotFoundException('Challenge not found');
    }

    // Check if challenge is already marked as completed
    const existingCompletion = await this.completedChallengeModel
      .findOne({ userId, challengeId })
      .exec();

    // Determine badge type based on challenge category
    const badgeType = this.getBadgeTypeFromChallenge(challenge);

    // Check if badge already exists
    let badge = await this.badgeModel
      .findOne({
        user: userId,
        challenge: challengeId,
      })
      .exec();

    // Check if stars already awarded for this project
    const existingStar = await this.starModel
      .findOne({
        user: userId,
        contentType: 'project',
        contentId: challengeId,
      })
      .exec();

    // Create CompletedChallenge record if it doesn't exist
    if (!existingCompletion) {
      const completedChallenge = new this.completedChallengeModel({
        userId: userId,
        challengeId: challengeId,
        completionNotes: completionNotes,
        workFileUrl: workFileUrl,
        completedAt: new Date(),
      });
      await completedChallenge.save();
    }

    if (badge) {
      // Update existing badge
      badge.isCompleted = true;
      return badge.save();
    } else {
      // Create new badge
      badge = new this.badgeModel({
        user: userId,
        challenge: challengeId,
        name: this.getBadgeName(badgeType),
        description: this.getBadgeDescription(badgeType),
        badgeType,
        tier: BadgeTier.BRONZE,
        icon: this.getBadgeIcon(badgeType),
        tasks: [{ description: 'Complete challenge', isCompleted: true }],
        isCompleted: true,
        imageUrl: this.getBadgeImageUrl(badgeType),
      });

      await badge.save();

      // Award 15 stars for project completion if not already awarded
      if (!existingStar) {
        const star = new this.starModel({
          user: userId,
          contentType: 'project',
          contentId: challengeId,
          title: 'Project Completion: ' + (challenge.title || 'Challenge'),
          completed: true,
          completedAt: new Date(),
          starValue: 15, // 15 stars per project
        });
        await star.save();
      }

      // Check for special badges
      await this.checkAndAwardSpecialBadges(userId);
      
      // Check for tier badges based on total stars
      await this.checkAndAwardTierBadges(userId);

      return badge;
    }
  }

  private getBadgeTypeFromChallenge(challenge: Challenge): string {
    // Get badge type based on challenge type or category
    // This assumes your challenge object has a populated categoryId field
    const categoryName = challenge.categoryId
      ? (challenge.categoryId as any).name?.toLowerCase()
      : challenge.type?.toLowerCase();

    if (categoryName?.includes('science')) {
      return 'science';
    } else if (categoryName?.includes('math')) {
      return 'math';
    } else if (categoryName?.includes('read')) {
      return 'reading';
    } else if (
      categoryName?.includes('cod') ||
      categoryName?.includes('program')
    ) {
      return 'coding';
    } else {
      return 'general';
    }
  }

  private getBadgeName(badgeType: string): string {
    // Define badge names based on type
    const badgeNames = {
      science: 'Science Explorer',
      math: 'Math Wizard',
      reading: 'Reading Champion',
      coding: 'Code Master',
      general: 'Achievement Unlocked',
    };

    return badgeNames[badgeType] || 'Achievement Unlocked';
  }

  private getBadgeDescription(badgeType: string): string {
    // Define badge descriptions based on type
    const badgeDescriptions = {
      science:
        'Completed a science challenge and demonstrated scientific curiosity',
      math: 'Mastered mathematical concepts and solved challenging problems',
      reading:
        'Demonstrated excellent reading comprehension and literary analysis',
      coding: 'Wrote functioning code and demonstrated programming skills',
      general: 'Successfully completed a learning challenge',
    };

    return (
      badgeDescriptions[badgeType] ||
      'Successfully completed a learning challenge'
    );
  }

  private getBadgeIcon(badgeType: string): string {
    // Define icons based on badge type
    const badgeIcons = {
      science: '🔬',
      math: '🧮',
      reading: '📚',
      coding: '💻',
      general: '🏆',
    };

    return badgeIcons[badgeType] || '🏆';
  }

  private getBadgeImageUrl(badgeType: string): string {
    // Placeholder for badge image URLs
    // In a real implementation, these would point to actual images
    const badgeImages = {
      science: '/assets/badges/science-explorer.png',
      math: '/assets/badges/math-wizard.png',
      reading: '/assets/badges/reading-champion.png',
      coding: '/assets/badges/code-master.png',
      general: '/assets/badges/achievement.png',
    };

    return badgeImages[badgeType] || '/assets/badges/achievement.png';
  }

  async checkAndAwardTierBadges(userId: string): Promise<void> {
    // Get total stars for the user
    const stars = await this.starModel
      .find({ user: userId, completed: true })
      .exec();
    
    // Calculate total stars based on starValue
    const totalStarValue = stars.reduce((total, star) => total + (star.starValue || 1), 0);
    
    // Count completed educational activities (only books, videos, games)
    const educationalActivities = stars.filter(s => 
      (s.contentType === 'video' || s.contentType === 'book' || s.contentType === 'game') && 
      s.educationalContent
    );
    
    const completedActivities = new Set(
      educationalActivities.map((s) => s.educationalContent?.toString()).filter(Boolean)
    ).size;

    // Check for Bronze - Explorer badge (3+ activities)
    if (completedActivities >= 3) {
      await this.awardTierBadge(
        userId,
        BadgeTier.BRONZE,
        'Explorer',
        'Complete at least 3 activities',
        '🧭',
      );
    }

    // Check for Silver - Rising Star badge (100+ stars)
    if (totalStarValue >= 100) {
      await this.awardTierBadge(
        userId,
        BadgeTier.SILVER,
        'Rising Star',
        'Earn 100 stars',
        '🌟',
      );
    }

    // Check for Gold - Power Player badge (200+ stars)
    if (totalStarValue >= 200) {
      await this.awardTierBadge(
        userId,
        BadgeTier.GOLD,
        'Power Player',
        'Earn 200 stars',
        '⚡',
      );
    }

    // Check for Legendary - Ultimate Legend badge (300+ stars)
    if (totalStarValue >= 300) {
      await this.awardTierBadge(
        userId,
        BadgeTier.LEGENDARY,
        'Ultimate Legend',
        'Earn 300+ stars',
        '👑',
      );
    }
  }

  async checkAndAwardSpecialBadges(userId: string): Promise<void> {
    // This is a placeholder for more complex logic to check and award special badges
    // In a real implementation, you would query various models to check for badge requirements

    // Get all completed challenges for different categories to check for Visionary badge
    const badges = await this.badgeModel
      .find({ user: userId, isCompleted: true })
      .exec();
    const badgeTypes = new Set(badges.map((b) => b.badgeType));

    // If user has badges in all main categories
    if (
      badgeTypes.has('science') &&
      badgeTypes.has('math') &&
      badgeTypes.has('reading') &&
      badgeTypes.has('coding')
    ) {
      await this.awardTierBadge(
        userId,
        BadgeTier.SPECIAL,
        'Visionary',
        'Earn badges in all main activity categories (Quizzes, Books, Videos, Projects, Mentorship)',
        '🔮',
      );
    }

    // The other special badges would require additional complex logic
    // For example, checking user activity across communities, projects, etc.
  }

  private async awardTierBadge(
    userId: string,
    tier: BadgeTier,
    name: string,
    description: string,
    icon: string,
  ): Promise<void> {
    // Check if the badge already exists
    const existingBadge = await this.badgeModel
      .findOne({
        user: userId,
        tier,
        name,
      })
      .exec();

    if (!existingBadge) {
      // Create the badge
      const badge = new this.badgeModel({
        user: userId,
        name,
        description,
        tier,
        icon,
        tasks: [{ description, isCompleted: true }],
        isCompleted: true,
        badgeType: tier,
        imageUrl: `/assets/badges/${tier}-${name.toLowerCase().replace(' ', '-')}.png`,
      });

      await badge.save();
    }
  }

  // Award stars for quiz completion (First-time signin)
  async awardQuizCompletionStars(userId: string, quizId: string): Promise<Star> {
    // Check if user has already been awarded stars for this quiz
    let star = await this.starModel
      .findOne({
        user: userId,
        contentType: 'quiz',
        contentId: quizId,
      })
      .exec();

    if (star) {
      // Stars already awarded for this quiz
      return star;
    }

    // Create new star entry
    star = new this.starModel({
      user: userId,
      contentType: 'quiz',
      contentId: quizId,
      title: 'Career Quiz Completion',
      completed: true,
      completedAt: new Date(),
      starValue: 5, // 5 stars per quiz
    });
    await star.save();

    // Check for tier badges
    await this.checkAndAwardTierBadges(userId);

    return star;
  }

  // Award stars for community post
  async awardCommunityPostStars(userId: string, postId: string): Promise<Star> {
    // Check if user has already been awarded stars for this post
    let star = await this.starModel
      .findOne({
        user: userId,
        contentType: 'community',
        contentId: postId,
      })
      .exec();

    if (star) {
      // Stars already awarded for this post
      return star;
    }

    // Create new star entry
    star = new this.starModel({
      user: userId,
      contentType: 'community',
      contentId: postId,
      title: 'Community Post',
      completed: true,
      completedAt: new Date(),
      starValue: 5, // 5 stars per community post
    });
    await star.save();

    // Check for tier badges
    await this.checkAndAwardTierBadges(userId);

    return star;
  }

  // Award stars for mentor session
  async awardMentorSessionStars(userId: string, sessionId: string): Promise<Star> {
    // Check if user has already been awarded stars for this session
    let star = await this.starModel
      .findOne({
        user: userId,
        contentType: 'mentor_session',
        contentId: sessionId,
      })
      .exec();

    if (star) {
      // Stars already awarded for this session
      return star;
    }

    // Create new star entry
    star = new this.starModel({
      user: userId,
      contentType: 'mentor_session',
      contentId: sessionId,
      title: 'Mentor Session',
      completed: true,
      completedAt: new Date(),
      starValue: 10, // 10 stars per mentor session
    });
    await star.save();

    // Check for tier badges
    await this.checkAndAwardTierBadges(userId);

    return star;
  }

  // Award stars for mentor review
  async awardMentorReviewStars(userId: string, reviewId: string): Promise<Star> {
    // Check if user has already been awarded stars for this review
    let star = await this.starModel
      .findOne({
        user: userId,
        contentType: 'mentor_review',
        contentId: reviewId,
      })
      .exec();

    if (star) {
      // Stars already awarded for this review
      return star;
    }

    // Create new star entry
    star = new this.starModel({
      user: userId,
      contentType: 'mentor_review',
      contentId: reviewId,
      title: 'Mentor Review',
      completed: true,
      completedAt: new Date(),
      starValue: 5, // 5 stars per mentor review
    });
    await star.save();

    // Check for tier badges
    await this.checkAndAwardTierBadges(userId);

    return star;
  }

  async getStudentRewardsSummary(userId: string) {
    const stars = await this.starModel.find({ user: userId }).exec();
    const badges = await this.badgeModel.find({ user: userId }).exec();

    // Calculate total star value (not just count)
    const totalStarValue = stars.reduce((total, star) => total + (star.starValue || 1), 0);

    // Group badges by tier
    const badgesByTier = {
      bronze: badges.filter((b) => b.tier === BadgeTier.BRONZE),
      silver: badges.filter((b) => b.tier === BadgeTier.SILVER),
      gold: badges.filter((b) => b.tier === BadgeTier.GOLD),
      legendary: badges.filter((b) => b.tier === BadgeTier.LEGENDARY),
      special: badges.filter((b) => b.tier === BadgeTier.SPECIAL),
    };

    return {
      totalStars: totalStarValue, // Return the sum of star values
      totalBadges: badges.length,
      starsByType: {
        quiz: stars
          .filter((s) => s.contentType === 'quiz')
          .reduce((sum, star) => sum + (star.starValue || 5), 0),
        video: stars
          .filter((s) => s.contentType === 'video')
          .reduce((sum, star) => sum + (star.starValue || 1), 0),
        book: stars
          .filter((s) => s.contentType === 'book')
          .reduce((sum, star) => sum + (star.starValue || 20), 0),
        game: stars
          .filter((s) => s.contentType === 'game')
          .reduce((sum, star) => sum + (star.starValue || 1), 0),
        project: stars
          .filter((s) => s.contentType === 'project')
          .reduce((sum, star) => sum + (star.starValue || 15), 0),
        community: stars
          .filter((s) => s.contentType === 'community')
          .reduce((sum, star) => sum + (star.starValue || 5), 0),
        mentor_session: stars
          .filter((s) => s.contentType === 'mentor_session')
          .reduce((sum, star) => sum + (star.starValue || 10), 0),
        mentor_review: stars
          .filter((s) => s.contentType === 'mentor_review')
          .reduce((sum, star) => sum + (star.starValue || 5), 0),
      },
      badgesByTier,
      badges: badges.map((badge) => ({
        id: badge._id,
        name: badge.name,
        description: badge.description,
        imageUrl: badge.imageUrl,
        badgeType: badge.badgeType,
        tier: badge.tier,
        icon: badge.icon,
        isCompleted: badge.isCompleted,
        completedAt: badge['createdAt'] || badge['updatedAt'],
      })),
      stars: stars.map((star) => ({
        id: star._id,
        title: star.title,
        contentType: star.contentType,
        starValue: star.starValue || 1, // Include star value in the response
        completedAt: star.completedAt,
      })),
    };
  }
}
