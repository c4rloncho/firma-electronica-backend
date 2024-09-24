import { Module } from '@nestjs/common';
import { FirmaService } from './firma.service';
import { FirmaController } from './firma.controller';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30m' }, // 30 minutos
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FirmaController],
  providers: [FirmaService],
})
export class FirmaModule {}