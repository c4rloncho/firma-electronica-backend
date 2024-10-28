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
  UseGuards,
} from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';
import { Delegate } from '../delegate/entities/delegado.entity';
import { AuthGuard } from '@nestjs/passport';

@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}
 

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
