import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class GiveToUserDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'INV-2024-001' })
  @IsString()
  inventoryNumber: string;

  @ApiPropertyOptional({ example: 'PF2X0001' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ example: 'AKT-2024-001' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiPropertyOptional({ example: 'Yangi xodimga berildi' })
  @IsOptional()
  @IsString()
  note?: string;
}
