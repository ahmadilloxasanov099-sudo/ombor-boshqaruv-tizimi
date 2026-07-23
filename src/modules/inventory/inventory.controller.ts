import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryService } from './inventory.service';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { CurrentUser, Roles } from '../auth';
import { BulkStockInDto } from './dto';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @ApiOperation({ summary: 'Barcha ombor holati' })
  @Roles(...MANAGERS)
  @Get()
  findAll(@Query('organizationId') organizationId: string, @CurrentUser() user: any) {
    const targetOrgId = organizationId ? organizationId : user?.organizationId;
    return this.inventoryService.findAll(targetOrgId, user);
  }

  @ApiOperation({ summary: 'Ombor hisobotini CSV formatda eksport qilish' })
  @Roles(...MANAGERS)
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
  @Roles(...MANAGERS)
  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @ApiOperation({ summary: 'Bitta mahsulot miqdori' })
  @Roles(...MANAGERS)
  @Get(':productId')
  findOne(@Param('productId') productId: string) {
    return this.inventoryService.findOne(productId);
  }

  @ApiOperation({ summary: 'Minimal daraja belgilash' })
  @Roles(...MANAGERS)
  @Patch('min-level')
  setMinLevel(@Body() dto: SetMinLevelDto) {
    return this.inventoryService.setMinLevel(dto);
  }

  @ApiOperation({ summary: "Bir vaqtda ko'p mahsulot kirim qilish" })
  @Roles(...MANAGERS)
  @Post('bulk-stock-in')
  bulkStockIn(@Body() dto: BulkStockInDto, @CurrentUser() user: any) {
    return this.inventoryService.bulkStockIn(dto, user.id);
  }

  @ApiOperation({ summary: 'Excel fayldan ommaviy mahsulotlar va jihozlarni omborga kirim qilish' })
  @Roles(...MANAGERS)
  @UseInterceptors(FileInterceptor('file'))
  @Post('import-excel')
  importExcel(
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.importExcel(file.buffer, user.id);
  }
}
