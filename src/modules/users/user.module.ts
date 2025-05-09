import { Module } from "@nestjs/common";
import { UserController } from "./user.controller";
import { AiModule } from "../ai/ai.module";
import { UserService } from "./user.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../auth/entities/users";

@Module({
    imports: [
        AiModule,
        TypeOrmModule.forFeature([User])
    ],
    controllers: [UserController],
    providers: [UserService]
})
export class UserModule {}