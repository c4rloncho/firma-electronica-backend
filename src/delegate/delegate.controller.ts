import { Controller, Post, Body, Param, Delete, Patch, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { DelegateService } from './delegate.service';
import { Delegate } from './entities/delegado.entity';

@Controller('delegates')
export class DelegateController {
  constructor(private readonly delegateService: DelegateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async appointDelegate(
    @Body() body: { ownerRut: string; delegateRut: string }
  ): Promise<Delegate> {
    const { ownerRut, delegateRut } = body;
    return this.delegateService.appointDelegate(ownerRut, delegateRut);
  }

  @Delete(':ownerRut')
  @HttpCode(HttpStatus.OK)
  async softDeleteDelegate(@Param('ownerRut') ownerRut: string) {
    return this.delegateService.softDeleteDelegate(ownerRut);
  }

  @Patch(':ownerRut/activate')
  @HttpCode(HttpStatus.OK)
  async activateDelegate(@Param('ownerRut') ownerRut: string): Promise<{message:string,delegate:Delegate}> {
    return this.delegateService.activateDelegate(ownerRut);
  }

  @Patch(':ownerRut/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateDelegate(@Param('ownerRut') ownerRut: string): Promise<Delegate> {
    return this.delegateService.deactivateDelegate(ownerRut);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getDelegates(): Promise<Delegate[]> {
    return this.delegateService.getDelegates();
  }

}