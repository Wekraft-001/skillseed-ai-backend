import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { LoggerModule } from "src/common/logger/logger.module";
import { ConfigModule } from "@nestjs/config";

@Module({
    imports: [LoggerModule, ConfigModule],
    providers: [AiService],
    exports: [AiService]
})
export class AiModule {}