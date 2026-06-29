import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { RegisterDriverDto } from './register-driver.dto';

export class RegisterDto {
  @IsString({ message: 'El firebaseId debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El firebaseId es obligatorio.' })
  firebaseId: string;

  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email: string;

  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  name: string;

  @IsEnum(Role, { message: 'El rol especificado no es válido.' })
  @IsNotEmpty({ message: 'El rol es obligatorio.' })
  role: Role;

  @IsOptional()
  @IsString({ message: 'El RIF debe ser una cadena de texto.' })
  rif?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDriverDto)
  driverDetails?: RegisterDriverDto;
}
