import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { SignerType } from "../entities/document-signature.entity";

export class SignerDto {
    @IsString()
    @IsNotEmpty()
    rut: string;
  
    @IsNotEmpty()
    order: number;

    @IsEnum(SignerType)
    @IsNotEmpty()
    type: SignerType;

    
  }