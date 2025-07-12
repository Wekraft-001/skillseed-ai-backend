import { Injectable } from '@nestjs/common';
import { WeaviateClientService } from './weaviate-client.service';
import {
  BookVector,
  VideoVector,
  WeaviateSearchOptions,
} from '../types/weaviate.types';
import { LoggerService } from 'src/common/logger/logger.service';

export interface SearchFilters {
  level?: string;
  ageGroup?: string;
  theme?: string;
  author?: string;
  careerRelevance?: string[];
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

@Injectable()
export class WeaviateSearchService {
  constructor(
    private logger: LoggerService,
    private weaviateClient: WeaviateClientService,
  ) {}

  async searchByText<T>(
    className: string,
    query: string,
    fields: string,
    options: WeaviateSearchOptions = { certainty: 0.7 },
  ): Promise<SearchResult<T>> {
    try {
      const { limit = 10, offset = 0, certainty = 0.7, filters = {} } = options;

      let queryBuilder = this.weaviateClient
        .getClient()
        .graphql.get()
        .withClassName(className)
        .withFields(fields)
        .withNearText({ concepts: [query], certainty })
        .withLimit(limit);

      if (offset > 0) {
        queryBuilder = queryBuilder.withOffset(offset);
      }

      if (Object.keys(filters).length > 0) {
        queryBuilder = this.applyFilters(queryBuilder, filters);
      }

      const result = await queryBuilder.do();
      const data = result.data.Get[className] || [];

      return {
        data,
        total: data.length,
        hasMore: data.length === limit,
      };
    } catch (error) {
      this.logger.error(`Error searching ${className}:`, error);
      throw error;
    }
  }

  async searchBooks(
    query: string,
    options: WeaviateSearchOptions = { certainty: 0.7 },
  ): Promise<SearchResult<BookVector>> {
    const fields =
      'title author level theme description keywords ageGroup careerRelevance';
    return this.searchByText<BookVector>('Book', query, fields, options);
  }

  async searchBooksByCareerPath(
    careerPath: string,
    ageGroup: string,
    limit: number = 5,
  ): Promise<BookVector[]> {
    try {
      const result = await this.weaviateClient
        .getClient()
        .graphql.get()
        .withClassName('Book')
        .withFields(
          'title author level theme description keywords ageGroup careerRelevance',
        )
        .withWhere({
          operator: 'And',
          operands: [
            {
              path: ['careerRelevance'],
              operator: 'ContainsAny',
              valueText: careerPath,
            },
            {
              path: ['ageGroup'],
              operator: 'Equal',
              valueText: ageGroup,
            },
          ],
        })
        .withLimit(limit)
        .do();

      return result.data.Get.Book || [];
    } catch (error) {
      this.logger.error('Error searching by career path:', error);
      throw error;
    }
  }

  async searchBooksByTheme(
    theme: string,
    ageGroup?: string,
    limit: number = 10,
  ): Promise<BookVector[]> {
    try {
      const whereConditions = [
        {
          path: ['theme'],
          operator: 'Equal',
          valueText: theme,
        },
      ];

      if (ageGroup) {
        whereConditions.push({
          path: ['ageGroup'],
          operator: 'Equal',
          valueText: ageGroup,
        });
      }

      const whereFilter =
        whereConditions.length > 1
          ? {
              operator: 'And' as const,
              operands: whereConditions,
            }
          : whereConditions[0];

      const result = await this.weaviateClient
        .getClient()
        .graphql.get()
        .withClassName('Book')
        .withFields(
          'title author level theme description keywords ageGroup careerRelevance',
        )
        .withWhere(whereFilter)
        .withLimit(limit)
        .do();

      return result.data.Get.Book || [];
    } catch (error) {
      this.logger.error('Error searching by theme:', error);
      throw error;
    }
  }

  async searchBooksByLevel(
    level: string,
    ageGroup?: string,
    limit: number = 10,
  ): Promise<BookVector[]> {
    try {
      const whereConditions = [
        {
          path: ['level'],
          operator: 'Equal',
          valueText: level,
        },
      ];

      if (ageGroup) {
        whereConditions.push({
          path: ['ageGroup'],
          operator: 'Equal',
          valueText: ageGroup,
        });
      }

      const whereClause =
        whereConditions.length > 1
          ? { operator: 'And', operands: whereConditions }
          : whereConditions[0];

      const result = await this.weaviateClient
        .getClient()
        .graphql.get()
        .withClassName('Book')
        .withFields(
          'title author level theme description keywords ageGroup careerRelevance',
        )
        .withWhere(whereClause)
        .withLimit(limit)
        .do();

      return result.data.Get.Book || [];
    } catch (error) {
      this.logger.error('Error searching by level:', error);
      throw error;
    }
  }

  // Advanced search with multiple criteria
  async advancedBookSearch(
    query: string,
    filters: SearchFilters,
    options: WeaviateSearchOptions = {},
  ): Promise<SearchResult<BookVector>> {
    const searchOptions = {
      ...options,
      filters: {
        ...filters,
        ...options.filters,
      },
    };

    return this.searchBooks(query, searchOptions);
  }

  // Recommendation methods
  async getRecommendations(
    careerPaths: string[],
    interests: string[],
    ageGroup: string,
    limit: number = 10,
  ): Promise<BookVector[]> {
    const allBooks: BookVector[] = [];
    const seen = new Set<string>();

    // Search by career paths
    for (const career of careerPaths) {
      const careerBooks = await this.searchBooksByCareerPath(
        career,
        ageGroup,
        3,
      );
      for (const book of careerBooks) {
        const key = `${book.title}-${book.author}`;
        if (!seen.has(key)) {
          seen.add(key);
          allBooks.push(book);
        }
      }
    }

    // Search by interests
    for (const interest of interests) {
      const interestBooks = await this.searchBooks(interest, {
        limit: 3,
        filters: { ageGroup },
      });
      for (const book of interestBooks.data) {
        const key = `${book.title}-${book.author}`;
        if (!seen.has(key)) {
          seen.add(key);
          allBooks.push(book);
        }
      }
    }

    return allBooks.slice(0, limit);
  }

  // Similar books recommendation
  async findSimilarBooks(
    bookId: string,
    limit: number = 5,
  ): Promise<BookVector[]> {
    try {
      const result = await this.weaviateClient
        .getClient()
        .graphql.get()
        .withClassName('Book')
        .withFields(
          'title author level theme description keywords ageGroup careerRelevance',
        )
        .withNearObject({ id: bookId })
        .withLimit(limit + 1) // +1 to exclude the original book
        .do();

      const books = result.data.Get.Book || [];
      // Filter out the original book
      return books.filter((book: any) => book.id !== bookId).slice(0, limit);
    } catch (error) {
      this.logger.error('Error finding similar books:', error);
      throw error;
    }
  }

  // Helper method to apply filters
  private applyFilters(queryBuilder: any, filters: Record<string, any>): any {
    const whereConditions = [];

    if (filters.level) {
      whereConditions.push({
        path: ['level'],
        operator: 'Equal',
        valueText: filters.level,
      });
    }

    if (filters.ageGroup) {
      whereConditions.push({
        path: ['ageGroup'],
        operator: 'Equal',
        valueText: filters.ageGroup,
      });
    }

    if (filters.theme) {
      whereConditions.push({
        path: ['theme'],
        operator: 'Equal',
        valueText: filters.theme,
      });
    }

    if (filters.author) {
      whereConditions.push({
        path: ['author'],
        operator: 'Equal',
        valueText: filters.author,
      });
    }

    if (filters.careerRelevance && filters.careerRelevance.length > 0) {
      whereConditions.push({
        path: ['careerRelevance'],
        operator: 'ContainsAny',
        valueText: filters.careerRelevance,
      });
    }

    if (whereConditions.length === 1) {
      return queryBuilder.withWhere(whereConditions[0]);
    } else if (whereConditions.length > 1) {
      return queryBuilder.withWhere({
        operator: 'And',
        operands: whereConditions,
      });
    }

    return queryBuilder;
  }
}
