import { Body, Controller, Post, UploadedFiles, UseInterceptors, HttpException, HttpStatus, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DelegateSignDto } from './dto/delegate-sign.dto';

@Controller('firma')
export class FirmaController {
  constructor(private readonly firmaService: FirmaService) {}

  @Post('delegate')
  async delegateSign(@Body()input:DelegateSignDto){
    try {
      return this.firmaService.delegateSign(input)
    } catch (error) {
      
    }

  }

}