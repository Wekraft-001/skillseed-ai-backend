import { ApiProperty } from '@nestjs/swagger';

export class SigninDto {
  @ApiProperty({
    description: 'User first name',
    example: 'Yannick',
    type: String,
  })
  firstName: string;

  @ApiProperty({
    description: 'User password',
    example: '123456',
    type: String,
    minLength: 10,
  })
  password: string;
}

export class RegisterResponseDto {
  @ApiProperty({
    example: 'User registered successully',
  })
  message: string;

  @ApiProperty({
    example: {
      id: '60f1b2b3b3b3b3b3b3b3b3b3',
      firstName: 'Yannick',
      lastName: 'Zahinda',
      email: 'yannick@gmail.test',
      role: 'super_admin',
      age: 100,
    },
  })
  user: object;
}

export class SigninResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ 
    example: {
      id: '60f1b2b3b3b3b3b3b3b3b3b3',
      firstName: 'Yannick',
      lastName: 'Zahinda',
      email: 'yannick@gmail.test',
      role: 'super_admin'
    }
  })
  user: object;
}
