import { IsNotEmpty } from "class-validator";

export class LoginDto{
    @IsNotEmpty()
    rut:string;

    @IsNotEmpty()
    password:string;
}