import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';
import { Delegate } from '../delegate/entities/delegado.entity';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { RegisterFuncionarioDto } from './dto/register-funcionario.dto';
import { Rol } from 'src/enums/rol.enum';

@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}
 

    @Post('register')
    @Roles(Rol.ADMIN)
    @UseGuards(AuthGuard('jwt'),RolesGuard)
    async registerFuncionario(@Req() req,
    @Body()input:RegisterFuncionarioDto ){
      return await this.funcionarioService.registerFuncionario(input)
    }

  //get info de un usuario 
  @Get('buscar')
  @UseGuards(AuthGuard('jwt'))
  async searchFuncionarios(@Query('query') query: string) {
    try {
      const funcionarios = await this.funcionarioService.searchFuncionarios(query);
      return funcionarios;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al procesar la solicitud',
      );
    }
  }

}
