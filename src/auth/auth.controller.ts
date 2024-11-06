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
  Req,
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
      const { access_token, refresh_token, user } =
        await this.authService.validateEmployee(input);

      res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });

      // Devolver el access token en el body para que el frontend lo maneje
      return {
        message: 'Login successful',
        access_token, // El frontend lo guardará en memoria o localStorage
        user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }

      if (error instanceof BadRequestException) {
        throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
      }

      if (error instanceof NotFoundException) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      throw new HttpException(
        'An unexpected error occurred during login. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  async refreshToken(@Req() req, @Res({ passthrough: true }) res: Response) {
    const { rut, refreshToken } = req.user;
    const { access_token, user, refresh_token } =
      await this.authService.refreshToken(rut, refreshToken);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
    return { access_token,user };
  }

  @Post('/logout')
  @UseGuards(AuthGuard('jwt-refresh'))
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    try {
      await this.authService.logout(req.user.rut);

      // Solo necesitamos limpiar el refresh token cookie
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });

      return {
        message: 'Logout exitoso',
        statusCode: 200,
      };
    } catch (error) {
      throw new UnauthorizedException('Error al cerrar sesión');
    }
  }

  @Get('check')
  @UseGuards(AuthGuard('jwt-refresh'))
  checkAuth() {
    return { isAuthenticated: true };
  }
}
