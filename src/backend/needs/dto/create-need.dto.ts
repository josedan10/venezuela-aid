import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsNumber, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class NeedItemDto {
  @IsString({ message: 'El ID del recurso debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El ID del recurso es obligatorio.' })
  resourceId: string;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  quantity: number;
}

export class CreateNeedDto {
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  description: string;

  @IsInt({ message: 'La urgencia debe ser un número entero.' })
  @Min(1, { message: 'La urgencia mínima es 1.' })
  @Max(5, { message: 'La urgencia máxima es 5.' })
  urgencyRating: number;

  @IsString({ message: 'El estado es obligatorio.' })
  @IsNotEmpty({ message: 'El estado es obligatorio.' })
  state: string;

  @IsString({ message: 'El sector es obligatorio.' })
  @IsNotEmpty({ message: 'El sector es obligatorio.' })
  sector: string;

  @IsOptional()
  @IsNumber({}, { message: 'La latitud debe ser un número decimal.' })
  latitude?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La longitud debe ser un número decimal.' })
  longitude?: number;

  @IsOptional()
  @IsString()
  collectionCenterId?: string;

  @ValidateNested({ each: true })
  @ArrayNotEmpty({ message: 'Debe agregar al menos un ítem a la necesidad.' })
  @Type(() => NeedItemDto)
  items: NeedItemDto[];
}
