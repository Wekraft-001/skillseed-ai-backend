import { Controller, Body, Post } from "@nestjs/common";
import { CreateStudentDto } from "./dtos";
import { AuthService } from "./auth.service";

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() dto: CreateStudentDto) {
        return this.authService.registerStudent(dto);
    }

    @Post('signin')
    sigin(@Body() body: { firstName: string; password: string }) {
        return this.authService.signin(body.firstName, body.password);
    }
}