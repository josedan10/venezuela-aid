import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ResourceCategory } from '@prisma/client';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ResourceCategory)
  category: ResourceCategory;
}
