import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @ApiOperation({ summary: "Barcha bo'limlar royxati" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @ApiOperation({ summary: "Bo'limlarni Excel (CSV) formatida eksport qilish" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get('export')
  async exportCsv(@Res() res: express.Response) {
    const csvContent = await this.departmentsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=bolimlar.csv',
    );
    return res.status(200).send(csvContent);
  }

  @ApiOperation({ summary: "Bitta bo'lim" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @ApiOperation({ summary: "Bo'lim statistikasi" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.departmentsService.getStats(id);
  }

  @ApiOperation({ summary: "Yangi bo'lim yaratish" })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: any) {
    return this.departmentsService.create(dto, user.id);
  }
  
  @ApiOperation({ summary: "Bo'limni tahrirlash" })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: any,
  ) {
    return this.departmentsService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: "Bo'limni o'chirish" })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.departmentsService.remove(id, user.id);
  }
}
