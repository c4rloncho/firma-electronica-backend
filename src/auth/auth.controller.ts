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
import { Roles } from './roles.decorator';
import { Rol } from 'src/enums/rol.enum';
import { RolesGuard } from './roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

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
        access_token, 
        user,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new HttpException(error?.message, HttpStatus.UNAUTHORIZED);
      }

      if (error instanceof BadRequestException) {
        throw new HttpException('Invalid input data', HttpStatus.BAD_REQUEST);
      }

      if (error instanceof NotFoundException) {
        throw new HttpException(error?.message, HttpStatus.NOT_FOUND);
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
    try {
      console.log('Iniciando refresh de token:', { rut: req.user?.rut });
      
      const { rut, refreshToken } = req.user;
      
      console.log('Datos extraídos del request:', { 
        tieneRut: !!rut, 
        tieneRefreshToken: !!refreshToken 
      });
  
      const { access_token, user, refresh_token } =
        await this.authService.refreshToken(rut, refreshToken);
  
      console.log('Nuevos tokens generados correctamente');
  
      res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      });
  
      console.log('Cookie refresh_token actualizada');
      return { access_token, user };
      
    } catch (error) {
      console.log('Error en refresh token:', error);
  
      if (error instanceof UnauthorizedException) {
        throw new HttpException(
          error?.message || 'Sesión inválida o expirada',
          HttpStatus.UNAUTHORIZED
        );
      }
  
      if (error instanceof BadRequestException) {
        throw new HttpException(
          'Datos de refresh inválidos',
          HttpStatus.BAD_REQUEST
        );
      }
  
      if (error instanceof NotFoundException) {
        throw new HttpException(
          error?.message || 'Usuario no encontrado',
          HttpStatus.NOT_FOUND
        );
      }
  
      throw new HttpException(
        'Error inesperado al renovar la sesión. Por favor intente nuevamente.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
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

  @Post('change-password')
  @Roles(Rol.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async changePassword(@Body() changePasswordDto: ChangePasswordDto) {
    try {
      await this.authService.changePassword(changePasswordDto);
      
      return {
        statusCode: 200,
        message: 'Contraseña actualizada correctamente'
      };
  
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException({
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message
        }, HttpStatus.NOT_FOUND);
      }
      
      if (error instanceof BadRequestException) {
        throw new HttpException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: error.message
        }, HttpStatus.BAD_REQUEST);
      }
  
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al actualizar la contraseña'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
