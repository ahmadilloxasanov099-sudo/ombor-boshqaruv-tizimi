import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { Roles } from '../auth';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @ApiOperation({ summary: "Umumiy ko'rsatkichlar" })
  @Roles(...MANAGERS)
  @Get('overview')
  getOverview() {
    return this.statsService.getOverview();
  }

  @ApiOperation({ summary: "Bo'lim bo'yicha jihozlar" })
  @Roles(...MANAGERS)
  @Get('by-department')
  getByDepartment() {
    return this.statsService.getByDepartment();
  }

  @ApiOperation({ summary: "Mahsulot bo'yicha sarflash" })
  @Roles(...MANAGERS)
  @Get('by-product')
  getByProduct() {
    return this.statsService.getByProduct();
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(...MANAGERS)
  @Get('low-stock')
  getLowStock() {
    return this.statsService.getLowStock();
  }

  @ApiOperation({ summary: 'Oylik dinamika' })
  @Roles(...MANAGERS)
  @Get('monthly')
  getMonthly() {
    return this.statsService.getMonthly();
  }

  @ApiOperation({ summary: "Oylik solishtirish (Bu oy vs O'tgan oy)" })
  @Roles(...MANAGERS)
  @Get('comparison')
  getComparison() {
    return this.statsService.getComparison();
  }

  @ApiOperation({ summary: "Xodim bo'yicha jihoz yuklamasi" })
  @Roles(...MANAGERS)
  @Get('by-user')
  getByUser() {
    return this.statsService.getByUser();
  }
}
