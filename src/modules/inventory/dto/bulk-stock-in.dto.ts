import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType, UnitType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkStockInItemDto {
  @ApiProperty({ example: 'Lenovo ThinkPad E15', description: 'Mahsulot nomi' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'LNV-E15', description: 'Mahsulot kodi' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ enum: ProductType, example: ProductType.ASSET })
  @IsEnum(ProductType)
  productType: ProductType;

  @ApiPropertyOptional({ enum: UnitType, example: UnitType.PIECE })
  @IsOptional()
  @IsEnum(UnitType)
  unit?: UnitType;

  @ApiPropertyOptional({ example: 'Dell Latitude 5520' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 3, description: 'Miqdor' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 9000000, description: '1 ta narxi' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ example: 'AKT-2024-001' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Yangi keldi' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkStockInDto {
  @ApiProperty({ type: [BulkStockInItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockInItemDto)
  items: BulkStockInItemDto[];
}