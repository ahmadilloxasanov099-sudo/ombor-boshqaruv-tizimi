import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AssignToDeptDto {
  @ApiProperty({ example: 'uuid', description: 'Bo\'lim ID si' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, description: 'Miqdor' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'AKT-2024-005', description: 'Hujjat raqami' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Bo\'lim uchun printer', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}