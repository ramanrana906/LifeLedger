import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

interface LoginBody {
  email?: string;
  password?: string;
}

interface RegisterBody extends LoginBody {
  name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterBody) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required.');
    }

    if (body.password.length < 6) {
      throw new UnauthorizedException(
        'Password must be at least 6 characters.',
      );
    }

    return this.authService.registerUser(body.email, body.password, body.name);
  }

  @Post('login')
  async login(@Body() body: LoginBody) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Email and password are required.');
    }

    const user = await this.authService.validateUser(body.email, body.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return user;
  }
}
