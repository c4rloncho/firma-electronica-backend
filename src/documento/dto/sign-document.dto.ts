import { Transform, Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsInt, Min, MaxLength, IsUUID } from "class-validator";

export class SignDocumentDto {
    @IsString()
    @IsNotEmpty()
    entity: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    purpose: string;

    @IsBoolean()
    @IsNotEmpty()
    @Type(()=>Boolean)
    isAttended: boolean;

    @IsString()
    @IsOptional()
    @MaxLength(50)
    cargoFirmante?: string;

    @IsString()
    @IsOptional()
    @MaxLength(100)
    nombreFirmante?: string;
    
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    documentId: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    heightImage?: number;

    @IsString()
    @IsOptional()
    @MaxLength(6)
    otp?: string;
}