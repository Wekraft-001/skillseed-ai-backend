import { Controller, Get, UseGuards, Req, Post, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from '../ai/ai.service';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly aiService: AiService,
    private readonly userServices: UserService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getProfile(@Req() req) {
    return req.user;
  }

  @Get('quiz')
  async getQuiz(@Req() req) {
    const age = req.user.age || 10;
    return this.aiService.generateCareerQuiz(age);
  }

  @Get('all')
  async getAllUsers() {
    return this.userServices.findAllUsers();
  }

  @Post('profile')
  async generateProfileOutCome(@Body('answers') answers: string[]) {
    return this.aiService.analyzeAnswers(answers);
  }
}
