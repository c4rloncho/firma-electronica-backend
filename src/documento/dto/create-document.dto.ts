import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SignerDto } from './signer.dto';

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


  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  heightSigns: number = 30;
}
