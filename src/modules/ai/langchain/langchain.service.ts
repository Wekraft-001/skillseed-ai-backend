import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { OpenAIEmbeddings } from '@langchain/openai';


@Injectable()
export class LanchainService{
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;

  constructor(private configService: ConfigService) {
    this.llm = new ChatOpenAI({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
      modelName: 'gpt-4-1106-preview',
      temperature: 0.7,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.configService.get('OPENAI_API_KEY'),
    });
  }


    async generateChallengeTemplate(careerField: string, skills: string[], ageGroup: string) {
    const prompt = PromptTemplate.fromTemplate(`
      Create an educational challenge template for a {ageGroup} interested in {careerField}.
      
      Skills to develop: {skills}
      
      Respond with JSON containing:
      - title
      - description
      - learningObjectives (array)
      - duration (minutes)
      - materials (array)
      - difficulty (easy, medium, hard)
      - steps (array of objects with stepNumber, instructions, expectedOutcome)
    `);

    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    const result = await chain.invoke({ careerField, skills: skills.join(', '), ageGroup });
    return JSON.parse(result);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }
}