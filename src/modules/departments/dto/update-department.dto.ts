import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ example: 'Moliya bo\'limi', description: 'Bo\'lim nomi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'MOLIYA', description: 'Bo\'lim kodi (unikal)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Moliyaviy operatsiyalar bo\'limi', description: 'Tavsif' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}