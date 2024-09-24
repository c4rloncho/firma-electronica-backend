import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as dotenv from 'dotenv';
dotenv.config();
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.json()); // Para JSON
  app.use(express.urlencoded({ extended: true })); 
  await app.listen(3000);
}
bootstrap();
