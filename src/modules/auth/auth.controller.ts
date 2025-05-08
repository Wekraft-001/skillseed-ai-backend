import { Controller, Body, Post } from "@nestjs/common";
import { CreateUserDto } from "./dtos";
import { AuthService } from "./auth.service";

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() dto: CreateUserDto) {
        return this.authService.registerUser(dto);
    }

    @Post('signin')
    sigin(@Body() body: { firstName: string; password: string }) {
        return this.authService.signin(body.firstName, body.password);
    }
}