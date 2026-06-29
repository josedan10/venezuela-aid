import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../role.enum';
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

  @IsString({ message: 'El campo roles debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El campo roles es obligatorio.' })
  roles: string;

  @IsOptional()
  @IsString({ message: 'El RIF debe ser una cadena de texto.' })
  rif?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegisterDriverDto)
  driverDetails?: RegisterDriverDto;
}
