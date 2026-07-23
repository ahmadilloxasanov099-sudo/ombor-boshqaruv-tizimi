import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';
import { CurrentUser, Roles } from '../auth';

const MANAGERS = [
  UserRole.SUPER_ADMIN,
  UserRole.VAZIRLIK_OMBORCHI,
  UserRole.ORG_ADMIN,
  UserRole.ORG_OMBORCHI,
  UserRole.ADMIN,
  UserRole.OMBORCHI,
  UserRole.KADR,
];

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: "Barcha xodimlar ro'yxati" })
  @Roles(...MANAGERS)
  @Get()
  findAll(@Query() query: UserQueryDto, @CurrentUser() user: any) {
    const targetOrgId = query.organizationId
      ? query.organizationId
      : (user?.organizationId ?? undefined);
    return this.usersService.findAll(
      { ...query, organizationId: targetOrgId },
      user,
    );
  }

  @ApiOperation({ summary: 'Xodimlarni Excel (CSV) formatida eksport qilish' })
  @Roles(...MANAGERS)
  @Get('export')
  async exportCsv(
    @Query() query: UserQueryDto,
    @CurrentUser() user: any,
    @Res() res: express.Response,
  ) {
    const targetOrgId = query.organizationId
      ? query.organizationId
      : (user?.organizationId ?? undefined);
    const csvContent = await this.usersService.exportCsv({
      ...query,
      organizationId: targetOrgId,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=xodimlar.csv');
    return res.status(200).send(csvContent);
  }

  @ApiOperation({ summary: 'Xodimlarni Excel faylidan ommaviy yuklash' })
  @Roles(...MANAGERS)
  @UseInterceptors(FileInterceptor('file'))
  @Post('import-excel')
  importExcel(@UploadedFile() file: any, @CurrentUser() user: any) {
    return this.usersService.importExcel(file.buffer, user.id);
  }

  @ApiOperation({ summary: "Bitta xodim ma'lumoti" })
  @Roles(...MANAGERS)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Xodimda hozir nima bor' })
  @Roles(...MANAGERS)
  @Get(':id/assignments')
  getAssignments(@Param('id') id: string) {
    return this.usersService.getAssignments(id);
  }

  @ApiOperation({ summary: 'Xodim tarixi' })
  @Roles(...MANAGERS, UserRole.XODIM)
  @Get(':id/history')
  getHistory(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (currentUser.role === UserRole.XODIM && currentUser.id !== id) {
      id = currentUser.id;
    }
    return this.usersService.getHistory(id);
  }

  @ApiOperation({ summary: "Yangi xodim qo'shish" })
  @Roles(...MANAGERS)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimni tahrirlash' })
  @Roles(...MANAGERS)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimni bloklash / faollashtirish' })
  @Roles(...MANAGERS)
  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.toggleStatus(id, user.id);
  }

  @ApiOperation({ summary: "Xodimni o'chirish (soft delete)" })
  @Roles(...MANAGERS)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Xodimning barcha jihozlarini qaytarish' })
  @Roles(...MANAGERS)
  @Post(':id/bulk-return')
  bulkReturn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.bulkReturn(id, user.id);
  }

  @ApiOperation({
    summary: "Xodimning barcha jihozlarini boshqa xodimga o'tkazish",
  })
  @Roles(...MANAGERS)
  @Post(':id/bulk-transfer')
  bulkTransfer(
    @Param('id') id: string,
    @Body('toUserId') toUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.bulkTransfer(id, toUserId, user.id);
  }
}
