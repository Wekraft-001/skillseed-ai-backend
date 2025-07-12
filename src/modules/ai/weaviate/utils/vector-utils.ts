export class VectorUtils {
    static determineAgeGroup(age: number): string {
        if(age < 8) return 'beginner';
        if(age < 12) return 'intermediate';
        if(age < 16) return 'adolescent';
        return 'young-adult';
    }

    static determineLevelFromAge(age: number): string {
        if (age < 8) return 'beginner';
        if (age <= 12) return 'intermediate';
        return 'advanced';
    }

    static extractKeywords(text: string): string[] {
    // Simple keyword extraction 
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 10);
  }
}