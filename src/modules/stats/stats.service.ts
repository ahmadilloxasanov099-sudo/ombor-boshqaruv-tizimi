import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      activeAssets,
      inventories,
    ] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.operation.count(),
      this.prisma.assignment.count({ where: { returnedAt: null } }),
      this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
      }),
    ]);

    const lowStockCount = inventories.filter(
      (i) => i.quantity < i.minLevel,
    ).length;

    const totalInventoryValue = inventories.reduce(
      (sum, i) => sum + Number(i.totalValue ?? 0),
      0,
    );

    const assignedAssets = await this.prisma.asset.findMany({
      where: { assignments: { some: { returnedAt: null } }, deletedAt: null },
      select: { purchasePrice: true },
    });

    const totalAssignedValue = assignedAssets.reduce(
      (sum, a) => sum + Number(a.purchasePrice ?? 0),
      0,
    );

    return {
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      lowStockCount,
      activeAssets,
      totalInventoryValue,
      totalAssignedValue,
    };
  }

  async getByDepartment() {
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null },
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
      userCount: dept._count.users,
      assets: dept.departmentAssets.map((da) => ({
        productName: da.product.name,
        productType: da.product.productType,
        quantity: da.quantity,
      })),
    }));
  }

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
          ['GIVE_TO_USER', 'GIVE_TO_DEPT'].includes(op.type),
        )
        .reduce((sum, op) => sum + (op._sum.quantity ?? 0), 0);

      return {
        id: product.id,
        name: product.name,
        productType: product.productType,
        currentStock: product.inventory?.quantity ?? 0,
        minLevel: product.inventory?.minLevel ?? 0,
        totalOut,
      };
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

    return items
      .filter((item) => item.quantity < item.minLevel)
      .map((item) => ({
        productId: item.productId,
        name: item.product.name,
        productType: item.product.productType,
        unit: item.product.unit,
        quantity: item.quantity,
        minLevel: item.minLevel,
        shortage: item.minLevel - item.quantity,
      }));
  }

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
      const month = op.createdAt.toISOString().slice(0, 7);
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

  async getByUser() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        fullName: true,
        username: true,
        position: true,
        department: { select: { id: true, name: true } },
        assignments: {
          where: { returnedAt: null },
          include: {
            asset: {
              include: {
                product: {
                  select: { id: true, name: true, productType: true },
                },
              },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return users.map((user) => {
      const assets = user.assignments.map((a) => ({
        assetId: a.asset.id,
        inventoryNumber: a.asset.inventoryNumber,
        status: a.asset.status,
        productName: a.asset.product.name,
        purchasePrice: a.asset.purchasePrice ?? 0,
        assignedAt: a.assignedAt,
      }));

      const totalValue = assets.reduce(
        (sum, a) => sum + Number(a.purchasePrice),
        0,
      );

      return {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        position: user.position,
        department: user.department,
        assetCount: assets.length,
        totalValue,
        assets,
      };
    });
  }
}