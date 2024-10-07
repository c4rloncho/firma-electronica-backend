import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class SignDocumentDto {


    @IsString()
    @IsNotEmpty()
    entity: string;

    @IsString()
    @IsNotEmpty()
    purpose: string;

    @IsBoolean()
    isAttended: boolean;

    @IsString()
    @IsOptional()
    cargoFirmante?: string;

    @IsString()
    @IsOptional()
    nombreFirmante?: string;
    
    @IsNotEmpty()
    @IsString()
    documentId: string;

    @IsNumber()
    @IsOptional()
    heightImage?: string;

    @IsString()
    @IsOptional()
    otp?: string;
}