import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirmaModule } from './firma/firma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FuncionarioModule } from './funcionario/funcionario.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoModule } from './documento/documento.module';
import { join } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AttachmentModule } from './attachment/attachment.module';
import { DelegateController } from './delegate/delegate.controller';
import { DelegateService } from './delegate/delegate.service';
import { DelegateModule } from './delegate/delegate.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config';
import { TypeDocument } from './type-document/entities/type-document.entity';
import { TypeDocumentModule } from './type-document/type-document.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => databaseConfig,
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
    }),
    FirmaModule,
    FuncionarioModule,
    DocumentoModule,
    AttachmentModule,
    DelegateModule,
    AuthModule,
    TypeDocumentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}