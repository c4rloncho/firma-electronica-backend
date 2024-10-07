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
} from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';
import { Delegate } from '../delegate/entities/delegado.entity';

@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}
 

  //get info de un usuario 
  @Get(':rut')
  async getFuncionarioByRut(@Param('rut') rut: string) {
    try {
      const funcionario = await this.funcionarioService.getByRut(rut);
      return funcionario;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al procesar la solicitud',
      );
    }
  }
  

}
