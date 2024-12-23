import { Transform, Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsInt, Min, MaxLength, IsUUID, IsEnum } from "class-validator";
import { EntityType } from "src/enums/entity-type.enum";

export class SignDocumentDto {
    @IsEnum(EntityType)
    @IsNotEmpty()
    entity: EntityType;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    purpose: string;

    @IsBoolean()
    @IsNotEmpty()
    isAttended: boolean;
    
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    documentId: number;


    @IsString()
    @IsOptional()
    @MaxLength(6)
    otp?: string;
}