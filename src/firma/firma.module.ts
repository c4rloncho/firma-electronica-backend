import { Module } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FirmaController } from './firma.controller';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentoModule } from 'src/documento/documento.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from 'src/documento/entities/document.entity';
import { DocumentSignature } from 'src/documento/entities/document-signature.entity';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { SignatureImageService } from './image-processor.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Document,DocumentSignature,Funcionario]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('FIRMAGOB_JWT_SECRET'),
        signOptions: { expiresIn: '30m' }, // 30 minutos
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FirmaController],
  providers: [FirmaService,SignatureImageService],
  exports:[FirmaService],
})
export class FirmaModule {}