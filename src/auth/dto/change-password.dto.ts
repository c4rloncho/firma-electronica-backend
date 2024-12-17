import { IsString } from "class-validator";

export class ChangePasswordDto{
    @IsString()
    rut:string;
    @IsString()
    password:string;
    @IsString()
    passwordConfirm:string;
}