import { Controller, Get, Post, Body, Param, Headers, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InternalService } from './internal.service';

@Controller('internal')
@ApiTags('Internal API')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(private readonly internalService: InternalService) {}

  // Validate JWT token for AI microservice
  @Get('auth/validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate JWT token (for AI microservice)' })
  async validateToken(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '');
    return this.internalService.validateToken(token);
  }

  // Get user data for AI microservice
  @Get('users/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user data (for AI microservice)' })
  async getUser(@Param('userId') userId: string) {
    return this.internalService.getUser(userId);
  }

  // Update user rewards from AI microservice
  @Post('rewards/update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user rewards (for AI microservice)' })
  async updateRewards(@Body() body: { userId: string; points: number }) {
    return this.internalService.updateRewards(body.userId, body.points);
  }

  // Health check for internal API
  @Get('health')
  @ApiOperation({ summary: 'Internal API health check' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'SkillSeed Main Service - Internal API',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}