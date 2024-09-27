import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class DelegateSignDto {
  @IsString()
  @IsNotEmpty()
  ownerRut: string;

  @IsString()
  @IsNotEmpty()
  delegateRut: string;
}