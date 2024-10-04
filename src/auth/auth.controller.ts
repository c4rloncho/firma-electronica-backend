import { Body, Controller, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('/validate')
  async validateRut(@Body()input:LoginDto){
    try {
      return this.authService.validateEmployee(input);
    } catch (error) {
      
    }
  }
  @Post('/register')
  async register(@Body()input:RegisterDto){
    try {
      return this.authService.registerEmployee(input);
    } catch (error) {
      
    }
  }

}
