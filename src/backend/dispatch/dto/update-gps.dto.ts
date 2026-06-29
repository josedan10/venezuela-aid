import { IsNumber, IsISO8601 } from 'class-validator';

export class GPSCoordinateDto {
  @IsNumber({}, { message: 'La latitud debe ser un número decimal.' })
  latitude: number;

  @IsNumber({}, { message: 'La longitud debe ser un número decimal.' })
  longitude: number;

  @IsISO8601({}, { message: 'La marca de tiempo debe ser una fecha ISO 8601 válida.' })
  timestamp: string;
}

export class UpdateGPSBatchDto {
  coordinates: GPSCoordinateDto[];
}
