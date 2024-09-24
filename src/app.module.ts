import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmaModule } from './firma/firma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal:true,
  }),FirmaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
