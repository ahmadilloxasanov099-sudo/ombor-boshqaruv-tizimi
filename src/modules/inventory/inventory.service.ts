import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { StockInDto } from './dto/stock-in.dto';
import { SetMinLevelDto } from './dto/set-min-level.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.inventory.findMany({
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

    return inventory;
  }

  async getLowStock() {
    return this.prisma.inventory.findMany({
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
    }).then((items) =>
      items.filter((item) => item.quantity < item.minLevel),
    );
  }

  async stockIn(dto: StockInDto, performedById: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId: dto.productId },
    });

    if (!inventory) {
      throw new NotFoundException('Mahsulot ombori topilmadi');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { increment: dto.quantity } },
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
  
}