import { Controller, Body, Post, UsePipes, HttpStatus } from "@nestjs/common";
import { CreateUserDto } from "./dtos";
import { AuthService } from "./auth.service";
import { SanitizePipe } from "../sanitizer/sanitize.pipe";
import { ApiResponse, ApiOperation } from "@nestjs/swagger";

@Controller('auth')
export class AuthController {
    constructor (private readonly authService: AuthService) {}

    @Post('register')
    @ApiOperation( {summary: 'Register a new user '} )
    @ApiResponse({ status: HttpStatus.CREATED, description: 'User registered successfully', })
    @ApiResponse({status: HttpStatus.BAD_REQUEST, description: 'Invalid input data',})
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'User already exists',
    })
    @UsePipes(new SanitizePipe())
    register(@Body() dto: CreateUserDto) {
        return this.authService.registerUser(dto);
    }

    @Post('signin')
    @UsePipes(new SanitizePipe())
    @ApiOperation({summary: 'User login'})
    @ApiResponse({ status: HttpStatus.OK, description: 'Login successful'})
    @ApiResponse({status: HttpStatus.UNAUTHORIZED, description: 'invalid credentials'})
    sigin(@Body() body: { firstName: string; password: string }) {
        return this.authService.signin(body.firstName, body.password);
    }

    
}