import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';

@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}

  @Post('delegate')
  async appointDelegate(@Body() body: { ownerRut: string; delegateRut: string }) {
    try {
      const { ownerRut, delegateRut } = body;
      const result = await this.funcionarioService.appointDelegate(ownerRut, delegateRut);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error al delegar la firma',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('delete')
  async deleteDelegate(@Body() body: { ownerRut: string; delegateRut: string }) {
    try {
      const { ownerRut, delegateRut } = body;
      return await this.funcionarioService.deleteDelegate(ownerRut, delegateRut);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: 'Error inesperado al eliminar delegado',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  } 
  @Get('all-delegates')
  async getDelegates() {
    try {
      const funcionario = await this.funcionarioService.getDelegates();
      return funcionario;
    } catch (error) {
      throw new InternalServerErrorException(
        'Ocurrió un error al procesar la solicitud',
      );
    }
  }

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
