import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductsService } from './product.service';
import { CurrentUser, Roles } from '../auth';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @ApiOperation({ summary: "Barcha mahsulotlar ro'yxati" })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.XODIM)
  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @ApiOperation({ summary: 'Kam qolgan mahsulotlar' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get('low-stock')
  getLowStock() {
    return this.productsService.getLowStock();
  }

  @ApiOperation({ summary: 'Bitta mahsulot' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI, UserRole.XODIM)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: 'Mahsulot harakatlari tarixi' })
  @Roles(UserRole.ADMIN, UserRole.OMBORCHI)
  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.productsService.getHistory(id);
  }

  @ApiOperation({ summary: "Yangi mahsulot qo'shish" })
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, user.id);
  }

  @ApiOperation({ summary: 'Mahsulotni tahrirlash' })
  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(id, dto, user.id);
  }

  @ApiOperation({ summary: "Mahsulotni o'chirish (soft delete)" })
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.id);
  }
}
