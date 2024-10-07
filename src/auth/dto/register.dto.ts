import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class RegisterDto{    
    @IsNotEmpty()
    @IsString()
    password:string

    @IsString()
    @IsNotEmpty()
    @MaxLength(10, { message: 'El RUT no puede tener más de 10 caracteres' })
    rut: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
    nombre: string;
  
    @IsEmail({}, { message: 'Debe proporcionar un correo electrónico válido' })
    @IsOptional()
    @MaxLength(90, { message: 'El correo no puede tener más de 90 caracteres' })
    correo?: string;
}