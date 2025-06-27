import { forwardRef, Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../schemas";
import { AiModule } from "../ai/ai.module";
import { LoggerModule } from "src/common/logger/logger.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        forwardRef(() => AiModule),
        LoggerModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [TypeOrmModule, UserService],
})
export class UserModule {}