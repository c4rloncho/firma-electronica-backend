import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  UnauthorizedException,
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
    }  catch (error) {
  
      if (error instanceof UnauthorizedException) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }
  
      if (error instanceof BadRequestException) {
        throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
      }
  
      if (error instanceof NotFoundException) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
  
      // For any other error types
      throw new HttpException(
        'An unexpected error occurred during login. Please try again later.',
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
