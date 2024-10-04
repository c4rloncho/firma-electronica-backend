import { Body, Controller, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

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
}
