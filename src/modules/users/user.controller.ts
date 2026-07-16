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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './user.service';
import { CurrentUser, Roles } from '../auth';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: "Barcha xodimlar ro'yxati" })
  @Roles(UserRole.ADMIN, UserRole.KADR)
  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.usersService.findAll(query);
  }

  @ApiOperation({ summary: "Bitta xodim ma'lumoti" })
  @Roles(UserRole.ADMIN, UserRole.KADR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @ApiOperation({ summary: 'Xodimda hozir nima bor' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get(':id/assignments')
  getAssignments(@Param('id') id: string) {
    return this.usersService.getAssignments(id);
  }

  @ApiOperation({ summary: 'Xodim tarixi' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.KADR)
  @Get(':id/history')
  getHistory(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (currentUser.role === UserRole.XODIM && currentUser.id !== id) {
      id = currentUser.id;
    }
    return this.usersService.getHistory(id);
  }

  @ApiOperation({ summary: "Yangi xodim qo'shish" })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimni tahrirlash' })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: 'Bloklash yoki faollashtirish' })
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  toggleStatus(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.toggleStatus(id, user.id);
  }

  @ApiOperation({ summary: "Xodimni o'chirish (soft delete)" })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user.id);
  }

  @ApiOperation({ summary: 'Xodimdan barcha jihozlarni qaytarish' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post(':id/bulk-return')
  bulkReturn(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.bulkReturn(id, user.id);
  }

  @ApiOperation({ summary: "Barcha jihozlarni boshqa xodimga o'tkazish" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post(':id/bulk-transfer')
  bulkTransfer(
    @Param('id') id: string,
    @Body('toUserId') toUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.bulkTransfer(id, toUserId, user.id);
  }
}
