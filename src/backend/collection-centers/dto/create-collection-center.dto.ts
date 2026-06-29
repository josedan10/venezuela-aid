import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCollectionCenterDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  description: string;

  @IsNumber({}, { message: 'La latitud debe ser un número decimal.' })
  @IsNotEmpty({ message: 'La latitud es obligatoria.' })
  latitude: number;

  @IsNumber({}, { message: 'La longitud debe ser un número decimal.' })
  @IsNotEmpty({ message: 'La longitud es obligatoria.' })
  longitude: number;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto.' })
  address?: string;

  @IsString({ message: 'Los servicios deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los servicios son obligatorios.' })
  services: string;
}
