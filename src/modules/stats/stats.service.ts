import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Umumiy ko'rsatkichlar
  // ─────────────────────────────────────────────
  async getOverview() {
    const [
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      lowStockCount,
      inventoryItems,
    ] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.department.count(),
      this.prisma.operation.count(),
      this.prisma.inventory.count({
        where: {
          product: { deletedAt: null, isActive: true },
        },
      }),
      this.prisma.inventory.findMany({
        include: { product: true },
      }),
    ]);

    const lowStock = inventoryItems.filter(
      (item) => item.quantity < item.minLevel,
    ).length;

    return {
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      lowStockCount: lowStock,
    };
  }

  // ─────────────────────────────────────────────
  // Bo'lim bo'yicha jihozlar
  // ─────────────────────────────────────────────
  async getByDepartment() {
    const departments = await this.prisma.department.findMany({
      include: {
        _count: { select: { users: true } },
        departmentAssets: {
          include: {
            product: { select: { name: true, productType: true } },
          },
        },
      },
    });

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      userCount: dept._count.users,
      assets: dept.departmentAssets.map((da) => ({
        productName: da.product.name,
        productType: da.product.productType,
        quantity: da.quantity,
      })),
    }));
  }

  // ─────────────────────────────────────────────
  // Mahsulot bo'yicha sarflash
  // ─────────────────────────────────────────────
  async getByProduct() {
    const operations = await this.prisma.operation.groupBy({
      by: ['productId', 'type'],
      _sum: { quantity: true },
      _count: { id: true },
    });

    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: { inventory: { select: { quantity: true, minLevel: true } } },
    });

    return products.map((product) => {
      const productOps = operations.filter((op) => op.productId === product.id);
      const totalOut = productOps
        .filter((op) =>
          ['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT'].includes(op.type),
        )
        .reduce((sum, op) => sum + (op._sum.quantity ?? 0), 0);

      return {
        id: product.id,
        name: product.name,
        code: product.code,
        productType: product.productType,
        currentStock: product.inventory?.quantity ?? 0,
        minLevel: product.inventory?.minLevel ?? 0,
        totalOut,
      };
    });
  }

  // ─────────────────────────────────────────────
  // Kam qolgan mahsulotlar
  // ─────────────────────────────────────────────
  async getLowStock() {
    const items = await this.prisma.inventory.findMany({
      where: {
        product: { deletedAt: null, isActive: true },
      },
      include: {
        product: {
          select: { id: true, name: true, code: true, productType: true, unit: true },
        },
      },
    });

    return items
      .filter((item) => item.quantity < item.minLevel)
      .map((item) => ({
        productId: item.productId,
        name: item.product.name,
        code: item.product.code,
        productType: item.product.productType,
        unit: item.product.unit,
        quantity: item.quantity,
        minLevel: item.minLevel,
        shortage: item.minLevel - item.quantity,
      }));
  }

  // ─────────────────────────────────────────────
  // Oylik dinamika
  // ─────────────────────────────────────────────
  async getMonthly() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const operations = await this.prisma.operation.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { type: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const monthly: Record<string, { month: string; stockIn: number; stockOut: number }> = {};

    operations.forEach((op) => {
      const month = op.createdAt.toISOString().slice(0, 7); // 2024-01
      if (!monthly[month]) {
        monthly[month] = { month, stockIn: 0, stockOut: 0 };
      }
      if (op.type === 'STOCK_IN') {
        monthly[month].stockIn += op.quantity;
      } else {
        monthly[month].stockOut += op.quantity;
      }
    });

    return Object.values(monthly);
  }
}