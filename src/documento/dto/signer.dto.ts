  import { IsEnum, IsNotEmpty, IsNumber, IsString } from "class-validator";
  import { SignerType } from "src/enums/signer-type.enum";

  export class SignerDto {
      @IsString()
      @IsNotEmpty()
      rut: string;
    
      @IsNotEmpty()
      @IsNumber()
      order: number;

      @IsEnum(SignerType)
      @IsNotEmpty()
      type: SignerType;

    }