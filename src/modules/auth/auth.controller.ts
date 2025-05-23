import { Controller, Body, Post, UsePipes } from "@nestjs/common";
import { CreateUserDto } from "./dtos";
import { AuthService } from "./auth.service";
import { SanitizePipe } from "../sanitizer/sanitize.pipe";

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Post('register')
    @UsePipes(new SanitizePipe())
    register(@Body() dto: CreateUserDto) {
        return this.authService.registerUser(dto);
    }

    @Post('signin')
    @UsePipes(new SanitizePipe())
    sigin(@Body() body: { firstName: string; password: string }) {
        return this.authService.signin(body.firstName, body.password);
    }

    
}