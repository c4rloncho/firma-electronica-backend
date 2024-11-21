import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class CreateTypeDocumentDto {
    @IsNotEmpty({ message: 'El nombre del tipo de documento es requerido' })
    @IsString({ message: 'El nombre debe ser una cadena de texto' })
    @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
    name: string;
}