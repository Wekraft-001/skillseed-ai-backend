import {
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Get,
  Req,
  Res,
   Controller, Body, Post, UsePipes, HttpStatus
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
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { LoggerService } from 'src/common/logger/logger.service';
import { ParentDashboardService } from '../dashboard/parents/services/dashboard.service';


@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private jwtService: JwtService,
    private logger: LoggerService,
    private readonly parentDashboardService: ParentDashboardService,
  ) {}

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

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: Request) {
    return { message: 'Redirecting to Google login......' };
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: User,
  ) {
    try {
      const payload = {
        sub: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phoneNumber: user.phoneNumber,
        email: user.email,
      };

      const token = await this.jwtService.sign(payload, { expiresIn: '1d' });

      // for testing purposes only
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .token { background: #f5f5f5; padding: 15px; border-radius: 5px; word-break: break-all; }
            .user-info { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>🎉 Google OAuth Success!</h1>
          <div class="user-info">
            <h3>User Info:</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            <p><strong>ID:</strong> ${user._id}</p>
          </div>
          <div class="token">
            <h3>JWT Token:</h3>
            <p>${token}</p>
          </div>
          <p><em>Copy this token to test your protected routes!</em></p>
          <script>
            // Also log to console for easy copying
            console.log('JWT Token:', '${token}');
          </script>
        </body>
        </html>
      `;
      res.send(html);
    } catch (error) {
      this.logger.error('Error in Google 0Auth callback: ', error);
      res.status(400).send(`
        <h1>❌ OAuth Error</h1>
        <p>Something went wrong: ${error.message}</p>
        <a href="/auth/google">Try Again</a>
      `);
    }
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
  @Post('addStudent')
  @UseInterceptors(FileInterceptor('image'))
  async registerStudent(
    @UploadedFile() image: Express.Multer.File,
    @Body() createStudentDto: CreateStudentDto,
    @CurrentUser() user: User,
  ) {
    return this.parentDashboardService.registerStudentByParent(createStudentDto, user, image);
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
