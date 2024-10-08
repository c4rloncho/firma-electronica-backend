import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { access_token, expiresIn } =
        await this.authService.validateEmployee(input);

      res.cookie('access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 3600000,  //1h
      });

      return { message: 'Login successful', expiresIn };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'An error occurred during login',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('/logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return { message: 'Logout successful' };
  }

  @Get('check')
  @UseGuards(AuthGuard('jwt'))
  checkAuth() {
    return { isAuthenticated: true };
  }
  // @Post('/register')
  // async register(@Body()input:RegisterDto){
  //   try {
  //     return this.authService.registerEmployee(input);
  //   } catch (error) {

  //   }
  // }
}
