import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GiveToUserDto {
  @ApiProperty({ example: 'uuid', description: 'Xodim ID si' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'uuid', description: 'Mahsulot ID si' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'INV-2024-001', description: 'Inventar raqami' })
  @IsString()
  inventoryNumber: string;

  @ApiPropertyOptional({ example: 'PF2X0001', description: 'Seriya raqami' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'AKT-2024-001', description: 'Hujjat raqami' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Yangi xodimga berildi', description: 'Izoh' })
  @IsOptional()
  @IsString()
  note?: string;
}