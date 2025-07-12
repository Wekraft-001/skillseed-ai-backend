import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { WeaviateClientService } from './services/weaviate-client.service';
import { WeaviateBooksService } from './services/weaviate-books.service';
// import { DataPopulationService } from '../content/services/data-population.service';

import { WeaviateSearchService } from './services/weaviate-search.service';

@Module({
  imports: [ConfigModule],
  providers: [
    WeaviateClientService,
    WeaviateBooksService,
    WeaviateSearchService,
    // DataPopulationService,
  ],
  exports: ['WEAVIATE_CLIENT'],
})
export class WeaviateModule {}
