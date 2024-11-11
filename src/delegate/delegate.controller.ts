import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  HttpException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DelegateService } from './delegate.service';
import { Delegate } from './entities/delegado.entity';
import { AuthGuard } from '@nestjs/passport';
import { User } from 'src/interfaces/firma.interfaces';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Rol } from 'src/enums/rol.enum';


@Controller('delegates')
export class DelegateController {
  constructor(private readonly delegateService: DelegateService) {}


  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async appointDelegate(
    @Req() req,
    @Body() body: { delegateRut: string },
  ): Promise<Delegate> {
    const user: User = req.user;
    const { delegateRut } = body;
    try {
      return await this.delegateService.appointDelegate(user.rut, delegateRut);
    } catch (error) {
      throw error;
    }
  }

  @Delete()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async softDeleteDelegate(@Req() req) {
    const user: User = req.user;
    return this.delegateService.softDeleteDelegate(user.rut);
  }

  @Patch('activate')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async activateDelegate(
    @Req() req,
  ): Promise<{ message: string; delegate: Delegate }> {
    const user: User = req.user;
    return this.delegateService.activateDelegate(user.rut);
  }

  @Patch('deactivate')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async deactivateDelegate(@Req() req): Promise<Delegate> {
    const user = req.user;
    return this.delegateService.deactivateDelegate(user.rut);
  }

  @Get('get-all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.OK)
  async getDelegates(): Promise<Delegate[]> {
    return this.delegateService.getDelegates();
  }
  @Get('my-delegate')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async getDelegatesRut(
    @Req() req,
  ): Promise<Delegate> {
    const user = req.user
    return this.delegateService.getDelegatesRut(user.rut);
  }

  
}
