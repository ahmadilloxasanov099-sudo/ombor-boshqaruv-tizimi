import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class ProductQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Noutbuk', description: 'Nom yoki kod bo\'yicha qidiruv' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ProductType, description: 'Mahsulot turi bo\'yicha filtri' })
  @IsOptional()
  @IsEnum(ProductType)
  productType?: ProductType;
}