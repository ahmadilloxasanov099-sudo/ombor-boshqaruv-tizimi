import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { t } from 'src/common';

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
          select: {
            quantity: true,
            minLevel: true,
            unitPrice: true,
            totalValue: true,
          },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(t('errors.PRODUCT_NOT_FOUND', {}, 'Mahsulot topilmadi'));
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto, updatedBy: string) {
    const oldProduct = await this.findOne(id);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        inventory: {
          select: { quantity: true, minLevel: true, unitPrice: true },
        },
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
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) {
      throw new NotFoundException(t('errors.PRODUCT_NOT_FOUND', {}, 'Mahsulot topilmadi'));
    }

    // 1. Ombordagi qoldiqni tekshirish
    if (product.inventory && product.inventory.quantity > 0) {
      throw new BadRequestException(
        t('errors.PRODUCT_IN_STOCK', {}, "Mahsulot omborda mavjud, o'chirib bo'lmaydi"),
      );
    }

    // 2. Jihozlar borligini tekshirish (Faqat BERILADIGAN uchun)
    const activeAssets = await this.prisma.asset.count({
      where: { productId: id, deletedAt: null },
    });
    if (activeAssets > 0) {
      // FIX: was `throw new Error(...)` which bypassed HttpExceptionFilter and returned 500
      throw new BadRequestException(
        t('errors.ACTIVE_ASSETS_EXIST', {}, "Mahsulotda aktiv jihozlar bor, o'chirib bo'lmaydi"),
      );
    }

    // 3. Bo'limlardagi qoldiqlarni tekshirish (DepartmentAsset quantity > 0)
    const activeDeptAssets = await this.prisma.departmentAsset.aggregate({
      where: { productId: id },
      _sum: { quantity: true },
    });
    if (activeDeptAssets._sum.quantity && activeDeptAssets._sum.quantity > 0) {
      throw new BadRequestException(
        t('errors.PRODUCT_IN_DEPTS', {}, "Ushbu mahsulot bo'limlarda mavjud, o'chirib bo'lmaydi"),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: AuditAction.DELETE,
          tableName: 'Product',
          recordId: id,
          oldData: product as any,
        },
      });

      return { message: "Mahsulot muvaffaqiyatli o'chirildi" };
    });
  }

  /**
   * Returns paginated operation history for a given product.
   * FIX: Added pagination — previously returned all rows without limit.
   */
  async getHistory(id: string, page = 1, limit = 20) {
    await this.findOne(id);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.operation.findMany({
        where: { productId: id },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, username: true } },
          fromUser: { select: { id: true, fullName: true, username: true } },
          asset: { select: { id: true, inventoryNumber: true } },
          department: { select: { id: true, name: true } },
          performedBy: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.operation.count({ where: { productId: id } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Returns products where current stock < minLevel.
   * FIX: Pushes the comparison to SQL via $queryRaw instead of loading all rows into memory.
   */
  async getLowStock(): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT
        i."productId",
        p.name,
        p."productType",
        p.unit,
        i.quantity,
        i."minLevel",
        (i."minLevel" - i.quantity) AS shortage
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i.quantity < i."minLevel"
        AND p."deletedAt" IS NULL
      ORDER BY shortage DESC
    `;
  }
}
