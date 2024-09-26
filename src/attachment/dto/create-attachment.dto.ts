import { IsNumber, IsNotEmpty, IsString } from 'class-validator';

export class CreateAttachmentDto {
  @IsNumber()
  @IsNotEmpty()
  documentId: number;

  @IsString()
  @IsNotEmpty()
  name:string
}