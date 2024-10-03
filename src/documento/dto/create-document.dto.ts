import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { SignerDto } from "./signer.dto";

export class CreateDocumentDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    creatorRut:string;
    
    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => SignerDto)
    signers: SignerDto[];
  }