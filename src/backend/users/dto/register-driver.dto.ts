import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class RegisterDriverDto {
  @IsString({ message: 'La cédula debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La cédula es obligatoria.' })
  cedula: string;

  @IsString({ message: 'Los detalles del vehículo deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los detalles del vehículo son obligatorios.' })
  vehicleDetails: string;

  @IsString({ message: 'La placa debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La placa es obligatoria.' })
  @Matches(/^[A-Z0-9-]{6,10}$/, { message: 'El formato de la placa no es válido. Debe contener entre 6 y 10 caracteres alfanuméricos.' })
  licensePlate: string;

  @IsString({ message: 'El enlace de la licencia de conducir debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La licencia de conducir es obligatoria para registrarse como conductor.' })
  licenseDocUrl: string;
}
