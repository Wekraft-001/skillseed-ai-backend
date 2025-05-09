import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class AiService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        })
    }

    async generateCareerQuiz(age: number): Promise<string> {
        const prompt = `Create 5 discovery questions for a child aged ${age} that assess: 
        - Preferences (hands-on, reading, building, helping)
        - Emotional and cognitive traits
        - Self-perception ("I like solving puzzles", etc.)

        Keep questions simple and friendly.
        `;

        const response = await this.openai.chat.completions.create({
            model: 'gpt4',
            messages: [{ role: 'user', content: prompt }],
        });

        return response.choices[0].message.content || '';
    }

    async analyzeAnswers(answers: string[]): Promise<any> {
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
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
        });

        return response.choices[0].message.content;
        
    }
}
