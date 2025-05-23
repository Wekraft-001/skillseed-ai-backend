import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from "./dtos";
import { User } from "./entities/users";
import { JwtService } from "@nestjs/jwt";
import { LoggerService } from "src/common/logger/logger.service";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly logger: LoggerService,
    ){}

    async registerUser(createUserDto: CreateUserDto) {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        const User = this.userRepo.create({
            ...createUserDto,
            password: hashedPassword,
        });

        return this.userRepo.save(User);
    }

    async signin(firstName: string, password: string) {
        this.logger.setContext('AuthService');

        const User = await this.userRepo.findOneBy({firstName});
        if(!User) {
            this.logger.warn(`Invalid credentials for user: ${firstName}`);
            throw new UnauthorizedException('Invalid credentials');
        };

        const isPasswordValid = await bcrypt.compare(password, User.password);
        if (!isPasswordValid) {
            this.logger.warn(`Invalid password attempt for user ${firstName}`);
            throw new UnauthorizedException('Invalid credentials: password')
        };

        this.logger.log(`User ${firstName} signed successfully`);
        return this.login(User);
    }

    async login(user: { id: number; firstName: string, age: number, email: string }) {
        const payload = { sub: user.id, firstName: user.firstName, age: user.age, email: user.email };
        this.logger.setContext('AuthService');
        this.logger.log(`JWT issued for user ${user.email}`);

        return {
          access_token: this.jwtService.sign(payload, {expiresIn: '1d'}),
        };
    }

}