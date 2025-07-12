import { ConfigService } from "@nestjs/config";

export const weaviateConfig = {
  host: process.env.WEAVIATE_HOST || 'localhost:8080',
  scheme: process.env.WEAVIATE_SCHEME || 'http',
  apiKey: process.env.WEAVIATE_API_KEY || '',
  openAIApiKey: process.env.OPENAI_API_KEY || '',
};

export const getWeaviateConfig = (configService: ConfigService) => ({
  host: configService.get<string>('WEAVIATE_HOST', 'localhost:8080'),
  scheme: configService.get<string>('WEAVIATE_SCHEME', 'http'),
  apiKey: configService.get<string>('WEAVIATE_API_KEY', ''),
  openAIApiKey: configService.get<string>('OPENAI_API_KEY', ''),
});