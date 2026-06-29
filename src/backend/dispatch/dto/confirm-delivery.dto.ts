import { IsString, IsOptional } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsOptional()
  @IsString({ message: 'El enlace de la firma digital debe ser una cadena de texto.' })
  signatureUrl?: string;

  @IsOptional()
  @IsString({ message: 'El enlace de la foto de entrega debe ser una cadena de texto.' })
  photoUrl?: string;
}
