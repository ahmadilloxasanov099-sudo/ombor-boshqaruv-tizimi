import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatsService } from './stats.service';
import { Roles } from '../auth';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @ApiOperation({ summary: 'Umumiy ko\'rsatkichlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('overview')
  getOverview() {
    return this.statsService.getOverview();
  }

  @ApiOperation({ summary: 'Bo\'lim bo\'yicha jihozlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('by-department')
  getByDepartment() {
    return this.statsService.getByDepartment();
  }

  @ApiOperation({ summary: 'Mahsulot bo\'yicha sarflash' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('by-product')
  getByProduct() {
    return this.statsService.getByProduct();
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('low-stock')
  getLowStock() {
    return this.statsService.getLowStock();
  }

  @ApiOperation({ summary: 'Oylik dinamika' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('monthly')
  getMonthly() {
    return this.statsService.getMonthly();
  }
}