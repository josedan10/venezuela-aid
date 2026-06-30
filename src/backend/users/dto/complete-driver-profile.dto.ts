import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { VehicleCategory } from '@prisma/client';

export class CompleteDriverProfileDto {
  @IsString({ message: 'La cédula debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  cedula: string;

  @IsEnum(VehicleCategory, { message: 'La categoría de vehículo no es válida.' })
  vehicleCategory: VehicleCategory;

  @IsInt({ message: 'El número de asientos debe ser un entero.' })
  @Min(1, { message: 'El vehículo debe tener al menos 1 asiento.' })
  @Max(60, { message: 'El número de asientos no puede superar 60.' })
  seatCount: number;

  @IsString({ message: 'Los detalles del vehículo deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los detalles del vehículo son obligatorios.' })
  vehicleDetails: string;

  @IsString({ message: 'La placa debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La placa es obligatoria.' })
  @Matches(/^[A-Z0-9-]{6,10}$/, {
    message: 'El formato de la placa no es válido. Debe contener entre 6 y 10 caracteres alfanuméricos.',
  })
  licensePlate: string;

  @IsOptional()
  @IsString({ message: 'El enlace de la licencia debe ser una cadena de texto.' })
  licenseDocUrl?: string;
}
