import { Module } from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';
import { FuncionarioController } from './funcionario.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Funcionario } from './entities/funcionario.entity';
import { Document } from 'src/documento/entities/document.entity';
import { Delegate } from '../delegate/entities/delegado.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Funcionario,Document]),
  ],
  controllers: [FuncionarioController],
  providers: [FuncionarioService],
})
export class FuncionarioModule {}
