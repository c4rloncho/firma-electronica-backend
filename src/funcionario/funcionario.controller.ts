import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';

@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}

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
