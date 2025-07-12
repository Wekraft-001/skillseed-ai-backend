import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EducationalContent } from "src/modules/schemas";
import { StorageService } from "../storage/storage.service";
import { WeaviateService } from "../weaviate/weaviate.service";
import { LanchainService } from "../langchain/langchain.service";

@Injectable()
export class ContentService {
    constructor(
        @InjectModel(EducationalContent.name) private contentModel: Model<EducationalContent>,
        private storageService: StorageService,
        private weaviateService: WeaviateService,
        private lanchainService: LanchainService
    ) {}

    async processAndStoreContent(file: Express.Multer.File, metadata: any) {
        const fileUrl = await this.storageService
    }

}