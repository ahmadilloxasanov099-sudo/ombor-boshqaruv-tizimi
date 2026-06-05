import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Moliya bo\'limi', description: 'Bo\'lim nomi' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'MOLIYA', description: 'Bo\'lim kodi (unikal)' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ example: 'Moliyaviy operatsiyalar bo\'limi', description: 'Tavsif' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}