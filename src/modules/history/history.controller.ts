import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HistoryService } from './history.service';
import { HistoryQueryDto } from './dto/history-query.dto';
import { CurrentUser, Roles } from '../auth';
import { UserRole } from '@prisma/client';

@ApiTags('History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
@Controller('history')
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @ApiOperation({ summary: 'Barcha harakatlar tarixi' })
  @Get()
  findAll(@Query() query: HistoryQueryDto, @CurrentUser() user: any) {
    return this.historyService.findAll(query, user.id, user.role);
  }

  @ApiOperation({ summary: 'Tarixni CSV formatda eksport qilish' })
  @Get('export')
  async exportCsv(
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const csvContent = await this.historyService.exportCsv(
      query,
      user.id,
      user.role,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=amallar_tarixi.csv',
    );
    return res.status(200).send(csvContent);
  }
}
