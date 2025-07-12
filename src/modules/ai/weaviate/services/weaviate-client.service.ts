import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { bookSchemaConfig } from "../config/schema.config";
import { LoggerService } from "src/common/logger/logger.service";

@Injectable()
export class WeaviateClientService implements OnModuleInit {
    private client: WeaviateClient;

    constructor(
        private logger: LoggerService,
        private configService: ConfigService
    ) {}

    async onModuleInit() {
        await this.initializeClient();
        await this.initializeSchema();
    }

    private async initializeClient() {
        const config = {
            scheme: this.configService.get<string>('WEAVIATE_SCHEME', 'http'),
            host: this.configService.get<string>('WEAVIATE_HOST', 'localhost:8080'),
        };

        const apiKey = this.configService.get<string>('WEAVIATE_API_KEY');
        if(apiKey) {
            config['apiKey'] = new weaviate.ApiKey(apiKey);
        }

        this.client = weaviate.client(config);
        this.logger.log('Weaviate client initialized');
    }

    private async initializeSchema() {
        try {
            const existingSchema = await this.client.schema.getter().do();

            const bookClassExists = existingSchema.classes?.some(
                (cls: any) => cls.class === 'Book'
            );

            if(!bookClassExists) {
                await this.client.schema.classCreator().withClass(bookSchemaConfig).do();
                this.logger.log('Book schema created successfully');
            }else {
                this.logger.log('Book schema already exists');
            } 
            
        } catch (error) {
            this.logger.error('Error initializing schema: ', error);
        }
    }

    getClient(): WeaviateClient{
        return this.client;
    }

    async isHealthy(): Promise<boolean> {
        try {
            await this.client.misc.liveChecker().do();
            return true;
            
        } catch (error) {
            this.logger.error('Weaviate health check failed: ', error);
            return false;
        }
    }



}