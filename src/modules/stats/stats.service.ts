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
      activeAssignments,
      inventories,
      writeOffs,
    ] = await Promise.all([
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.operation.count(),
      this.prisma.assignment.count({ where: { returnedAt: null } }),
      this.prisma.inventory.findMany({
        where: { product: { deletedAt: null } },
      }),
      this.prisma.operation.findMany({
        where: { type: 'WRITE_OFF' },
        include: {
          product: { include: { inventory: true } },
          asset: true,
        },
      }),
    ]);

    const lowStockCount = inventories.filter(
      (i) => i.quantity < i.minLevel,
    ).length;

    // Real-time calculation from actual quantity and unitPrice
    const totalInventoryValue = inventories.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.unitPrice ?? 0),
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

    const totalWriteOffCount = writeOffs.length;
    const totalWriteOffLoss = writeOffs.reduce((sum, op) => {
      const price = op.asset?.purchasePrice
        ? Number(op.asset.purchasePrice)
        : op.product?.inventory?.unitPrice
          ? Number(op.product.inventory.unitPrice)
          : 0;
      return sum + Number(op.quantity) * price;
    }, 0);

    return {
      totalProducts,
      totalUsers,
      totalDepartments,
      totalOperations,
      lowStockCount,
      activeAssignments,
      totalInventoryValue,
      totalAssignedValue,
      totalWriteOffCount,
      totalWriteOffLoss,
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
        assignments: {
          where: { returnedAt: null },
          include: { asset: true },
        },
        users: {
          where: { deletedAt: null, isActive: true },
          include: {
            assignments: {
              where: { returnedAt: null },
              include: { asset: true },
            },
          },
        },
      },
    });

    return departments.map((dept) => {
      const directValue = dept.assignments.reduce(
        (sum, a) => sum + Number(a.asset.purchasePrice ?? 0),
        0,
      );

      const userAssetsValue = dept.users.reduce((userSum, user) => {
        const userValue = user.assignments.reduce(
          (sum, a) => sum + Number(a.asset.purchasePrice ?? 0),
          0,
        );
        return userSum + userValue;
      }, 0);

      const totalValue = directValue + userAssetsValue;

      return {
        id: dept.id,
        name: dept.name,
        userCount: dept._count.users,
        totalAssetValue: totalValue,
        assets: dept.departmentAssets.map((da) => ({
          productName: da.product.name,
          productType: da.product.productType,
          quantity: da.quantity,
        })),
      };
    });
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
          ['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT'].includes(op.type),
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

    const monthly: Record<
      string,
      { month: string; stockIn: number; stockOut: number }
    > = {};

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

  async getComparison() {
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    const [thisMonthOps, lastMonthOps] = await Promise.all([
      this.prisma.operation.findMany({
        where: {
          createdAt: { gte: thisMonthStart, lte: thisMonthEnd },
        },
        include: {
          product: { include: { inventory: true } },
          asset: true,
        },
      }),
      this.prisma.operation.findMany({
        where: {
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        include: {
          product: { include: { inventory: true } },
          asset: true,
        },
      }),
    ]);

    const calculateMetrics = (ops: any[]) => {
      let stockInQty = 0;
      let stockInValue = 0;
      let stockOutQty = 0;
      let stockOutValue = 0;
      let writeOffQty = 0;
      let writeOffValue = 0;

      ops.forEach((op) => {
        const unitPrice = op.asset?.purchasePrice
          ? Number(op.asset.purchasePrice)
          : op.product?.inventory?.unitPrice
            ? Number(op.product.inventory.unitPrice)
            : 0;

        const opValue = Number(op.quantity) * unitPrice;

        if (op.type === 'STOCK_IN') {
          stockInQty += op.quantity;
          stockInValue += opValue;
        } else if (
          ['GIVE_TO_USER', 'GIVE_TO_DEPT', 'ASSIGN_TO_DEPT'].includes(op.type)
        ) {
          stockOutQty += op.quantity;
          stockOutValue += opValue;
        } else if (op.type === 'WRITE_OFF') {
          writeOffQty += op.quantity;
          writeOffValue += opValue;
        }
      });

      return {
        totalOperations: ops.length,
        stockInQty,
        stockInValue,
        stockOutQty,
        stockOutValue,
        writeOffQty,
        writeOffValue,
      };
    };

    const thisMonth = calculateMetrics(thisMonthOps);
    const lastMonth = calculateMetrics(lastMonthOps);

    const getPercentageChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      thisMonthName: thisMonthStart.toLocaleString('uz-UZ', { month: 'long' }),
      lastMonthName: lastMonthStart.toLocaleString('uz-UZ', { month: 'long' }),
      comparison: {
        totalOperations: {
          thisMonth: thisMonth.totalOperations,
          lastMonth: lastMonth.totalOperations,
          changePercent: getPercentageChange(
            thisMonth.totalOperations,
            lastMonth.totalOperations,
          ),
        },
        stockInValue: {
          thisMonth: thisMonth.stockInValue,
          lastMonth: lastMonth.stockInValue,
          changePercent: getPercentageChange(
            thisMonth.stockInValue,
            lastMonth.stockInValue,
          ),
        },
        stockOutValue: {
          thisMonth: thisMonth.stockOutValue,
          lastMonth: lastMonth.stockOutValue,
          changePercent: getPercentageChange(
            thisMonth.stockOutValue,
            lastMonth.stockOutValue,
          ),
        },
        writeOffValue: {
          thisMonth: thisMonth.writeOffValue,
          lastMonth: lastMonth.writeOffValue,
          changePercent: getPercentageChange(
            thisMonth.writeOffValue,
            lastMonth.writeOffValue,
          ),
        },
      },
    };
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
