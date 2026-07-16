import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
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
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @ApiOperation({ summary: 'Ombor hisobotini CSV formatda eksport qilish' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get('export')
  async exportCsv(@Res() res: express.Response) {
    const csvContent = await this.inventoryService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=ombor_qoldiqlari.csv',
    );
    return res.status(200).send(csvContent);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @ApiOperation({ summary: 'Bitta mahsulot miqdori' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
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
