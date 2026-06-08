import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { StockInDto } from './dto/stock-in.dto';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { BulkStockInDto, BulkStockInItemDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.inventory.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            productType: true,
            unit: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => ({
      ...item,
      totalValue: item.quantity * Number(item.unitPrice ?? 0), // ← real-time hisoblanadi
      isLowStock: item.quantity < item.minLevel, // ← kam qolganmi
    }));
  }

  async findOne(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            productType: true,
            unit: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return {
      ...inventory,
      totalValue: inventory.quantity * Number(inventory.unitPrice ?? 0),
      isLowStock: inventory.quantity < inventory.minLevel,
    };
  }

  async getLowStock() {
    return this.prisma.inventory
      .findMany({
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
        orderBy: { updatedAt: 'desc' },
      })
      .then((items) => items.filter((item) => item.quantity < item.minLevel));
  }

  async stockIn(dto: StockInDto, performedById: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return this.prisma.$transaction(async (tx) => {
      const newQuantity = inventory.quantity + dto.quantity;
      const totalValue = newQuantity * dto.unitPrice;

      const updated = await tx.inventory.update({
        where: { productId: dto.productId },
        data: {
          quantity: { increment: dto.quantity },
          unitPrice: dto.unitPrice,
          totalValue: totalValue,
        },
        include: {
          product: {
            select: { id: true, name: true, code: true, productType: true },
          },
        },
      });

      await tx.operation.create({
        data: {
          type: 'STOCK_IN',
          quantity: dto.quantity,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return updated;
    });
  }

  async setMinLevel(dto: SetMinLevelDto) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return this.prisma.inventory.update({
      where: { productId: dto.productId },
      data: { minLevel: dto.minLevel },
      include: {
        product: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async bulkStockIn(dto: BulkStockInDto, performedById: string) {
    const results: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        // Product bor-yo'qligini tekshiradi
        let product = await tx.product.findFirst({
          where: {
            ...(item.code ? { code: item.code } : { name: item.name }),
            deletedAt: null,
          },
          include: { inventory: true },
        });

        // Yo'q bo'lsa — yangi Product + Inventory yaratadi
        if (!product) {
          product = await tx.product.create({
            data: {
              name: item.name,
              code: item.code,
              productType: item.productType,
              unit: item.unit ?? 'PIECE',
              description: item.description,
            },
            include: { inventory: true },
          });

          await tx.inventory.create({
            data: {
              productId: product.id,
              quantity: 0,
              minLevel: 0,
            },
          });
        }

        // Inventory yangilash
        const updatedInventory = await tx.inventory.update({
          where: { productId: product.id },
          data: {
            quantity: { increment: item.quantity },
            unitPrice: item.unitPrice,
            totalValue: {
              increment: item.quantity * item.unitPrice,
            },
          },
        });

        // STOCK_IN operatsiyasi yoziladi
        await tx.operation.create({
          data: {
            type: 'STOCK_IN',
            quantity: item.quantity,
            productId: product.id,
            performedById,
            documentNumber: item.documentNumber,
            note: item.note,
          },
        });

        results.push({
          productId: product.id,
          name: product.name,
          code: product.code,
          quantity: updatedInventory.quantity,
          unitPrice: item.unitPrice,
          totalValue: updatedInventory.quantity * item.unitPrice,
        });
      }
    });

    return {
      message: `${dto.items.length} ta mahsulot muvaffaqiyatli kirim qilindi`,
      count: dto.items.length,
      results,
    };
  }
}
