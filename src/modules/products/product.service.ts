import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: ProductQueryDto) {
    const { page = 1, limit = 20, search, productType } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(productType && { productType }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inventory: {
            select: { quantity: true, minLevel: true, unitPrice: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        inventory: {
          select: { quantity: true, minLevel: true, unitPrice: true, totalValue: true },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Mahsulot topilmadi');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const oldProduct = await this.findOne(id);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        inventory: { select: { quantity: true, minLevel: true, unitPrice: true } },
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'Product',
      recordId: id,
      oldData: oldProduct,
      newData: updatedProduct,
    });

    return updatedProduct;
  }

  async remove(id: string, deletedBy: string) {
    const product = await this.findOne(id);

    const activeAssets = await this.prisma.asset.count({
      where: { productId: id, deletedAt: null },
    });

    if (activeAssets > 0) {
      throw new Error("Mahsulotda aktiv jihozlar bor, o'chirib bo'lmaydi");
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      action: AuditAction.DELETE,
      tableName: 'Product',
      recordId: id,
      oldData: product,
    });

    return { message: "Mahsulot muvaffaqiyatli o'chirildi" };
  }

  async getHistory(id: string) {
    await this.findOne(id);

    return this.prisma.operation.findMany({
      where: { productId: id },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        fromUser: { select: { id: true, fullName: true, username: true } },
        asset: { select: { id: true, inventoryNumber: true } },
        department: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLowStock() {
    const items = await this.prisma.inventory.findMany({
      where: {
        product: { deletedAt: null },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
          },
        },
      },
    });

    return items.filter((item) => item.quantity < item.minLevel);
  }
}