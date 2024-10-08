import { Type } from 'class-transformer';
import { IsNumber, IsNotEmpty, IsString } from 'class-validator';

export class CreateAttachmentDto {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  documentId: number;

  @IsString()
  @IsNotEmpty()
  name:string
}