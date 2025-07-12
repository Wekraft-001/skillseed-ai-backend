export interface BookVector {
    title: string;
    author: string;
    level: 'beginner' | 'intermediate' | 'advanced'
    theme: string;
    description: string;
    keywords: string[];
    ageGroup: 'early-childhood' | 'middle-childhood' |'adolescent' | 'young-adult';
    careerRelevance: string[];
}

export interface VideoVector {
  title: string;
  url: string;
  description: string;
  duration: number;
  platform: string;
  keywords: string[];
  ageGroup: string;
  careerRelevance: string[];
}

export interface WeaviateSearchOptions {
    limit?: number;
    offset?: number;
    certainty: number;
    filters?: Record<string, any>;
}