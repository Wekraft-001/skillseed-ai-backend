import { Controller, Get, UseGuards, Req, Post, Body, BadRequestException } from '@nestjs/common';
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

  @UseGuards(AuthGuard('jwt'))
  @Get('quiz')
  async getQuiz(@Req() req) {
    const age = req.user?.age;
    if(!age) throw new BadRequestException('Age is missing from user token');
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
