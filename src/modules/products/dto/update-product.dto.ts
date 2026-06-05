import { ApiPropertyOptional } from '@nestjs/swagger';
import { UnitType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Noutbuk', description: 'Mahsulot nomi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'NB-001', description: 'Mahsulot kodi' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ enum: UnitType, example: UnitType.PIECE, description: 'O\'lchov birligi' })
  @IsOptional()
  @IsEnum(UnitType)
  unit?: UnitType;

  @ApiPropertyOptional({ example: 'Dell Latitude 5520', description: 'Tavsif' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Rasm URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}