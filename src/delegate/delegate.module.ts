import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelegateController } from './delegate.controller';
import { DelegateService } from './delegate.service';
import { Funcionario } from '../funcionario/entities/funcionario.entity'; 
import { Delegate } from './entities/delegado.entity';
import { DocumentSignature } from 'src/documento/entities/document-signature.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delegate,DocumentSignature], 'secondConnection'),
    TypeOrmModule.forFeature([Funcionario], 'default'),
  ],
  controllers: [DelegateController],
  providers: [DelegateService],
  exports: [DelegateService], // Exportamos el servicio por si necesitamos usarlo en otros módulos
})
export class DelegateModule {}
