import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmaModule } from './firma/firma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FuncionarioModule } from './funcionario/funcionario.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoModule } from './documento/documento.module';
import config from './database/config';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AttachmentModule } from './attachment/attachment.module';
import { DelegateController } from './delegate/delegate.controller';
import { DelegateService } from './delegate/delegate.service';
import { DelegateModule } from './delegate/delegate.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(config[0]),
    TypeOrmModule.forRoot(config[1]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
    }),
    FirmaModule,
    FuncionarioModule,
    DocumentoModule,
    AttachmentModule,
    DelegateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
