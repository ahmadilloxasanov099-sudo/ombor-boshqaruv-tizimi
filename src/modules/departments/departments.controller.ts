import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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
