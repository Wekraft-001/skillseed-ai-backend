import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt';
import { CreateStudentDto } from "./dtos";
import { Student } from "./entities/students";
import { JwtService } from "@nestjs/jwt";
import { LoggerService } from "src/common/logger/logger.service";

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(Student)
        private readonly studentRepo: Repository<Student>,
        private readonly jwtService: JwtService,
        private readonly logger: LoggerService,
    ){}

    async registerStudent(createStudentDto: CreateStudentDto) {
        const hashedPassword = await bcrypt.hash(createStudentDto.password, 10);
        const student = this.studentRepo.create({
            ...createStudentDto,
            password: hashedPassword,
        });

        return this.studentRepo.save(student);
    }

    async signin(firstName: string, password: string) {
        this.logger.setContext('AuthService');

        const student = await this.studentRepo.findOneBy({firstName});
        if(!student) {
            this.logger.warn(`Invalid credentials for user: ${firstName}`);
            throw new UnauthorizedException('Invalid credentials');
        };

        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            this.logger.warn(`Invalid password attempt for user ${firstName}`);
            throw new UnauthorizedException('Invalid credentials: password')
        };

        this.logger.log(`User ${firstName} signed successfully`);
        return this.login(student);
    }

    async login(user: { id: number; email: string }) {
        const payload = { sub: user.id, email: user.email };
        this.logger.setContext('AuthService');
        this.logger.log(`JWT issued for user ${user.email}`);

        return {
          access_token: this.jwtService.sign(payload),
        };
      }
}