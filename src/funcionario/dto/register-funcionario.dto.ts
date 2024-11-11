import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { Rol } from "src/enums/rol.enum";

export class RegisterFuncionarioDto {
    @IsNotEmpty()
    @IsString()
    @MinLength(3)
    name: string;

    @IsNotEmpty()
    @IsString()
    rut: string;
    
    @IsNotEmpty()
    @IsString()
    @IsEmail()  
    correo: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsNotEmpty()
    @IsString()
    rol: Rol

    @IsNotEmpty()
    @IsString()
    cargo: string;
}