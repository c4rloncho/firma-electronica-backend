import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SignerDto } from './signer.dto';
import { Funcionario } from 'src/funcionario/entities/funcionario.entity';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => SignerDto)
  signers: SignerDto[];

  @IsArray()
  rutsToNotify: string[];
}
