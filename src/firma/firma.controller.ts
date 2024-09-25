import { Body, Controller, Post, UploadedFiles, UseInterceptors, HttpException, HttpStatus, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('firma')
export class FirmaController {
  constructor(private readonly firmaService: FirmaService) {}


}