import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryService } from './inventory.service';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { CurrentUser, Roles } from '../auth';
import { BulkStockInDto } from './dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Barcha ombor holati' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @ApiOperation({ summary: 'Bitta mahsulot miqdori' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get(':productId')
  findOne(@Param('productId') productId: string) {
    return this.inventoryService.findOne(productId);
  }

  @ApiOperation({ summary: 'Minimal daraja belgilash' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Patch('min-level')
  setMinLevel(@Body() dto: SetMinLevelDto) {
    return this.inventoryService.setMinLevel(dto);
  }

  @ApiOperation({ summary: "Bir vaqtda ko'p mahsulot kirim qilish" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('bulk-stock-in')
  bulkStockIn(@Body() dto: BulkStockInDto, @CurrentUser() user: any) {
    return this.inventoryService.bulkStockIn(dto, user.id);
  }
}