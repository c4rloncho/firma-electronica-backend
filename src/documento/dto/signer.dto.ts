import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { SignerType } from "src/enums/signer-type.enum";

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