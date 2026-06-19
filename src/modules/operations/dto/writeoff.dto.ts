import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class WriteOffDto {
  @ApiPropertyOptional({ example: 'uuid', description: 'BERILADIGAN uchun asset ID' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'SARFLANADIGAN uchun product ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ example: 'AKT-2024-010' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Eskirgan' })
  @IsOptional()
  @IsString()
  note?: string;
}