import {
  Controller,
  Body,
  Post,
  UsePipes,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CreateAdminOrParentDto, CreateStudentDto, LoginDto } from './dtos';
import { AuthService } from './auth.service';
import { SanitizePipe } from '../sanitizer/sanitize.pipe';
import {
  ApiResponse,
  ApiOperation,
  ApiTags,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { User } from '../schemas';
import { UserRole } from 'src/common/interfaces';
import { CurrentUser } from 'src/common/decorators';
import { FileInterceptor } from '@nestjs/platform-express';

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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PARENT, UserRole.SCHOOL_ADMIN)
  // @UsePipes(new SanitizePipe())
  @Post('addStudent')
  @UseInterceptors(FileInterceptor('image'))
  async registerStudent(
    @UploadedFile() image: Express.Multer.File,
    @Body() createStudentDto: CreateStudentDto,
    @CurrentUser() user: User,
  ) {
    return this.authService.registerStudent(createStudentDto, user, image);
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
  sigin(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('school/signin')
  async schoolLogin(@Body() dto: LoginDto) {
    return this.authService.schoolSignin(dto);
  }

  @Post('child/signin')
  async childLogin(@Body() credentials: {firstName: string, password: string}) {
    return this.authService.childLogin(credentials)
  }
}
