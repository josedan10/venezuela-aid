import { IsString, IsNotEmpty, IsEnum, IsInt, Min, IsOptional, IsISO8601 } from 'class-validator';
import { ResourceCategory } from '@prisma/client';

export class CreateResourceDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsEnum(ResourceCategory, { message: 'La categoría no es válida.' })
  @IsNotEmpty({ message: 'La categoría es obligatoria.' })
  category: ResourceCategory;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  stockQuantity: number;

  @IsOptional()
  @IsISO8601({}, { message: 'La fecha de vencimiento debe tener un formato ISO 8601 válido.' })
  expirationDate?: string;
}
