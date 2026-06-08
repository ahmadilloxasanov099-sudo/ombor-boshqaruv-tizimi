import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
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
      isActive: true,
      ...(productType && { productType }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
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
            select: { quantity: true, minLevel: true },
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
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: {
        inventory: {
          select: { quantity: true, minLevel: true },
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

  async create(dto: CreateProductDto, createdBy: string) {
    if (dto.code) {
      const existing = await this.prisma.product.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(
          'Bu kod bilan mahsulot allaqachon mavjud',
        );
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: dto,
      });

      await tx.inventory.create({
        data: {
          productId: created.id,
          quantity: 0,
          minLevel: 0,
        },
      });

      return tx.product.findUnique({
        where: { id: created.id },
        include: {
          inventory: { select: { quantity: true, minLevel: true } },
        },
      });
    });

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      tableName: 'Product',
      recordId: product!.id,
      newData: product,
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const oldProduct = await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.product.findUnique({
        where: { code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          'Bu kod bilan mahsulot allaqachon mavjud',
        );
      }
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        inventory: { select: { quantity: true, minLevel: true } },
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

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
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
        asset: { select: { id: true, code: true, inventoryNumber: true } },
        department: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLowStock() {
    const items = await this.prisma.inventory.findMany({
      where: {
        product: { deletedAt: null, isActive: true },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            productType: true,
            unit: true,
          },
        },
      },
    });

    return items.filter((item) => item.quantity < item.minLevel);
  }
}
