import { IsNotEmpty, IsString } from "class-validator";

export class SignerDto {
    @IsString()
    @IsNotEmpty()
    rut: string;
  
    @IsNotEmpty()
    order: number;
  }