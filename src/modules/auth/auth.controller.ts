import { Controller, Body, Post, UsePipes, HttpStatus } from '@nestjs/common';
import { CreateAdminOrParentDto, LoginDto } from './dtos';
import { AuthService } from './auth.service';
import { SanitizePipe } from '../sanitizer/sanitize.pipe';
import {
  ApiResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
} from '@nestjs/swagger';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiTags('Authentication')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiOperation({ summary: 'Register a new user ' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request - Invalid input data',
  })
  @UsePipes(new SanitizePipe())
  register(@Body() dto: CreateAdminOrParentDto) {
    return this.authService.registerAdminOrParent(dto);
  }

  @ApiTags('Authentication')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiOperation({ summary: 'Register a new user ' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  @ApiBadRequestResponse({
    description: 'Bad Request - Invalid input data',
  })

  
  @Post('signin')
  @ApiTags('Authentication')
  @UsePipes(new SanitizePipe())
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'invalid credentials',
  })
  sigin(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('school/signin')
  async schoolLogin(@Body() dto: LoginDto) {
    return this.authService.schoolSignin(dto);
  }

  @Post('mentor/signin')
  async mentorLogin(@Body() dto: LoginDto) {
    return this.authService.mentorSignin(dto);
  }

  @Post('child/signin')
  async childLogin(
    @Body() credentials: { firstName: string; password: string },
  ) {
    return this.authService.childLogin(credentials);
  }
}
