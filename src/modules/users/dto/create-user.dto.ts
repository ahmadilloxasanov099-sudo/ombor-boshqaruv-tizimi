import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Alisher Karimov', description: 'To\'liq ism' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'alisher01', description: 'Foydalanuvchi nomi (unikal)' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'parol123', description: 'Parol (minimum 6 ta belgi)' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.XODIM, description: 'Rol' })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: 'uuid', description: 'Bo\'lim ID si' })
  @IsString()
  departmentId: string;

  @ApiPropertyOptional({ example: '+998901234567', description: 'Telefon raqami' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'alisher@example.com', description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Bosh mutaxassis', description: 'Lavozim' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  position?: string;
}