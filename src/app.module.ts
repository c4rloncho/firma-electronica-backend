import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmaModule } from './firma/firma.module';
import { ConfigModule } from '@nestjs/config';
import { FuncionarioModule } from './funcionario/funcionario.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoModule } from './documento/documento.module';
import config from './database/config';

@Module({
  imports: [
    TypeOrmModule.forRoot(config),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    FirmaModule,
    FuncionarioModule,
    DocumentoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
