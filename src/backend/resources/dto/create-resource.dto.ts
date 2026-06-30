import { IsString, IsNotEmpty, IsEnum, IsInt, Min, IsOptional, IsISO8601, IsLatitude, IsLongitude, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ResourceCategory } from '@prisma/client';

export class CreateResourceDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  name?: string;

  @IsOptional()
  @IsEnum(ResourceCategory, { message: 'La categoría no es válida.' })
  category?: ResourceCategory;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  stockQuantity: number;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de vencimiento debe tener un formato ISO 8601 válido.' })
  expirationDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude({ message: 'La latitud no es válida.' })
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude({ message: 'La longitud no es válida.' })
  longitude?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID('4', { message: 'El ID del centro de acopio no es válido.' })
  collectionCenterId?: string;
}
