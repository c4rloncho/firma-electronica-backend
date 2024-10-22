import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Configurar CORS
  const corsOptions: CorsOptions = {
    origin: process.env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS','PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };
  app.enableCors(corsOptions);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.use(express.json()); // Para JSON
  app.use(express.urlencoded({ extended: true })); 

  const port = process.env.PORT || 4000;
  await app.listen(port);
}
bootstrap();