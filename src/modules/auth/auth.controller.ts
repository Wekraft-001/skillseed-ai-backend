import { Controller, Body, Post, UsePipes, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from './dtos';
import { AuthService } from './auth.service';
import { SanitizePipe } from '../sanitizer/sanitize.pipe';
import {
  ApiResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
  ApiProperty,
  ApiBody,
} from '@nestjs/swagger';
import { SigninDto, UserRole } from 'src/common/interfaces';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiTags('Authentication')
  @ApiBody({
    type: SigninDto,
    description: 'User registration data',
    examples: {
      student: {
        summary: 'Student Registration',
        description: 'Example of registering a student',
        value: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          age: 20,
          role: 'student',
          password: 'securePassword123',
        },
      },
      parent: {
        summary: 'Parent registration',
        description: 'Example of registering a parent',
        value: {
            firstName: 'Yann',
            lastName: 'Zahinda',
            email: 'yann@test.com',
            age: 26,
            role: UserRole.PARENT,
            password: 'securePassword123'
        }
      },
      superAdmin: {
        summary: 'Super admin registration',
        description: 'Example of registration an admin',
        value: {
            firstName: 'Sam',
            lastName: 'Wintchester',
            email: 'samwhatever@test.com',
            age: 30,
            role: UserRole.SUPER_ADMIN,
            password: '123456'
        }
      },
      mentor: {
        summary: 'mentor registration',
        description: 'Example of registration an admin',
        value: {
            firstName: 'Sam',
            lastname: 'Wintchester',
            email: 'samwhatever@test.com',
            age: 30,
            role: UserRole.MENTOR,
            password: '123456'
        }
      }
    },
  })
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
    schema: {
        example: {
            statusCode: 400,
            message: ['email must be a valid email', 'password must be longer than 6 characters'],
            error: 'Bad Request'
        }
    }
  })
  @UsePipes(new SanitizePipe())
  register(@Body() dto: CreateUserDto) {
    return this.authService.registerUser(dto);
  }

  @Post('signin')
  @ApiTags('Authentication')
  @UsePipes(new SanitizePipe())
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Login successful' })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'invalid credentials',
  })
  sigin(@Body() body: { firstName: string; password: string }) {
    return this.authService.signin(body.firstName, body.password);
  }
}
