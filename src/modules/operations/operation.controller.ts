import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { OperationsService } from './operation.service';
import { CurrentUser, Roles } from '../auth';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operations')
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @ApiOperation({ summary: 'Xodimga jihoz berish (ASSET)' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('give-to-user')
  giveToUser(@Body() dto: GiveToUserDto, @CurrentUser() user: any) {
    return this.operationsService.giveToUser(dto, user.id);
  }

  @ApiOperation({ summary: 'Xodimdan jihoz qaytarish' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('return-from-user')
  returnFromUser(@Body() dto: ReturnFromUserDto, @CurrentUser() user: any) {
    return this.operationsService.returnFromUser(dto, user.id);
  }

  @ApiOperation({ summary: 'Bir xodimdan ikkinchisiga o\'tkazish' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('transfer-user')
  transferUser(@Body() dto: TransferUserDto, @CurrentUser() user: any) {
    return this.operationsService.transferUser(dto, user.id);
  }

  @ApiOperation({ summary: 'Bo\'limga material berish (CONSUMABLE)' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('give-to-dept')
  giveToDept(@Body() dto: GiveToDeptDto, @CurrentUser() user: any) {
    return this.operationsService.giveToDept(dto, user.id);
  }

  @ApiOperation({ summary: 'Bo\'limga umumiy jihoz berish (SHARED)' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('assign-to-dept')
  assignToDept(@Body() dto: AssignToDeptDto, @CurrentUser() user: any) {
    return this.operationsService.assignToDept(dto, user.id);
  }

  @ApiOperation({ summary: 'Bo\'limdan jihoz qaytarish' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Post('return-from-dept')
  returnFromDept(@Body() dto: ReturnFromDeptDto, @CurrentUser() user: any) {
    return this.operationsService.returnFromDept(dto, user.id);
  }
}