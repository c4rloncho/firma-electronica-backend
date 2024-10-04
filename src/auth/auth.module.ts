import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports:[TypeOrmModule.forFeature([Funcionario],'default'),
  JwtModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => ({
      secret: configService.get<string>('JWT_SECRET'),
      signOptions: { 
        expiresIn: configService.get<string>('JWT_EXPIRATION'),
      },
    }),
    inject: [ConfigService],
  }),],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
