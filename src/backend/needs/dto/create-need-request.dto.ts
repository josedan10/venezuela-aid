import { IsString, IsNotEmpty } from 'class-validator';
import { CreateNeedDto } from './create-need.dto';

export class CreateNeedRequestDto extends CreateNeedDto {
  @IsString({ message: 'El ID de la ONG debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El ID de la ONG es obligatorio.' })
  ngoId: string;
}
