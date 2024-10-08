import { Body, Controller, Get, Param, Post,Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  async validateRut(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { access_token, expiresIn } =
        await this.authService.validateEmployee(input);
      return { access_token,expiresIn };
    } catch (error) {}
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
