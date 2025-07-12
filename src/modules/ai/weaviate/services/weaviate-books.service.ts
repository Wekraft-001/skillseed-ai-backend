import { Injectable } from '@nestjs/common';
import { WeaviateClientService } from './weaviate-client.service';
import { BookVector, WeaviateSearchOptions } from '../types/weaviate.types';
import { LoggerService } from 'src/common/logger/logger.service';
import { title } from 'process';

@Injectable()
export class WeaviateBooksService {
  constructor(
    private logger: LoggerService,
    private weaviateClient: WeaviateClientService,
  ) {}

  async addBook(book: BookVector): Promise<string> {
    try {
      const result = await this.weaviateClient
        .getClient()
        .data.creator()
        .withClassName('Book')
        .withProperties({
          title: book.title,
          author: book.author,
          level: book.level,
          theme: book.theme,
          description: book.description,
          keywords: book.keywords,
          ageGroup: book.ageGroup,
          careerRelevance: book.careerRelevance,
        })
        .do();

      this.logger.log(`Book added successfylly: ${book.title}`);
      return result.id;
    } catch (error) {
      this.logger.error('ERror adding bood to Weaviate: ', error);
      throw error;
    }
  }

  async addMultipleBooks(books: BookVector[]): Promise<string[]> {
    const results = [];
    for (const book of books) {
      try {
        const result = await this.addBook(book);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to add book: ${book.title}`, error);
      }
    }
    return results;
  }


  async updateBook(id: string, book: Partial<BookVector>): Promise<void> {
    try {
      await this.weaviateClient
        .getClient()
        .data
        .updater()
        .withClassName('Book')
        .withId(id)
        .withProperties(book)
        .do();
      
      this.logger.log(`Book updated successfully: ${id}`);
    } catch (error) {
      this.logger.error('Error updating book:', error);
      throw error;
    }
  }

  async deleteBook(id: string): Promise<void> {
    try {
      await this.weaviateClient
        .getClient()
        .data
        .deleter()
        .withClassName('Book')
        .withId(id)
        .do();
      
      this.logger.log(`Book deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error('Error deleting book:', error);
      throw error;
    }
  }

  async getBookById(id: string): Promise<BookVector | null> {
    try {
      const result = await this.weaviateClient
        .getClient()
        .data
        .getterById()
        .withClassName('Book')
        .withId(id)
        .do();
      
      return result.properties as any;
    } catch (error) {
      this.logger.error('Error getting book by ID:', error);
      return null;
    }
  }

  async getAllBooks(limit: number = 100): Promise<BookVector[]> {
    try {
      const result = await this.weaviateClient
        .getClient()
        .graphql
        .get()
        .withClassName('Book')
        .withFields('title author level theme description keywords ageGroup careerRelevance')
        .withLimit(limit)
        .do();

      return result.data.Get.Book || [];
    } catch (error) {
      this.logger.error('Error getting all books:', error);
      throw error;
    }
  }

}
