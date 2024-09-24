import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class SingDocumentDto{
    @IsString()
    @IsNotEmpty()
    run: string;

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
    cargoFirmante:string

    @IsString()
    @IsOptional()
    nombreFirmante:string

    @IsNumber()
    @IsOptional()
    heightImage?:string

    @IsString()
    @IsOptional()
    otp?: string;
}
