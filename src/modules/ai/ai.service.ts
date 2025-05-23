import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class AiService {
    private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private readonly logger: LoggerService
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_API_KEY'),
      maxRetries: 2,
    });
  }

  async generateCareerQuiz(age: number): Promise<string> {
    try {
      const prompt = `Create 5 discovery questions for a child aged ${age} that assess: 
        - Preferences (hands-on, reading, building, helping)
        - Emotional and cognitive traits
        - Self-perception ("I like solving puzzles", etc.)

        Keep questions simple and friendly.
        `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });

      return response.choices[0].message.content || '';
    } catch (error) {
        this.logger.error('OpenAI API Error: ', error);

        if(error.status === 429) {
            throw new Error('OpenAI API  rate limit exceeded. Please check your account status.')
        }

        throw error;
    }
  }

  async analyzeAnswers(answers: string[]): Promise<any> {
    try {
        const prompt = `
        Given the following answers from a child: 
        ${answers.join('\n')}

        Generate: 
        - Personality Type (Creator, Solver, Nurture, Builder, or any you thing is best fit)
        - Suggested Carreer Clusters
        - Interests
        - Strengths & Growth Areas
        - Recommended Learning Style(Visual, Kinesthetic, Auditory, etc.)
        `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content;
        
    } catch (error) {
        this.logger.error('OpenAI API Error: ', error);
        throw error;
    }
  }
}
