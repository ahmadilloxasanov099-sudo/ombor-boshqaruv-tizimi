import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { BulkStockInDto } from './dto';
import { ProductType } from '@prisma/client';

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
            productType: true,
            unit: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return items.map((item) => ({
      ...item,
      totalValue: item.quantity * Number(item.unitPrice ?? 0),
      isLowStock: item.quantity < item.minLevel,
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
          select: { id: true, name: true },
        },
      },
    });
  }

  async bulkStockIn(dto: BulkStockInDto, performedById: string) {
    const results: any[] = [];

    // 1. Ommaviy validatsiya (Senior Validation)
    const allInventoryNumbers: string[] = [];
    for (const item of dto.items) {
      if (item.productType === ProductType.BERILADIGAN) {
        if (
          !item.inventoryNumbers ||
          item.inventoryNumbers.length !== item.quantity
        ) {
          throw new BadRequestException(
            `"${item.name}" jihozi uchun aynan ${item.quantity} ta inventar raqam yuborilishi shart!`,
          );
        }
        allInventoryNumbers.push(...item.inventoryNumbers);
      }
    }

    if (allInventoryNumbers.length > 0) {
      // Payload ichida takroriy inventar raqamlar borligini tekshirish
      const uniqueNumbers = new Set(allInventoryNumbers);
      if (uniqueNumbers.size !== allInventoryNumbers.length) {
        throw new BadRequestException(
          'Ommaviy yuklanayotgan inventar raqamlari ichida takrorlanishlar mavjud!',
        );
      }

      // Bazada ushbu inventar raqamlari band emasligini tekshirish
      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          inventoryNumber: { in: allInventoryNumbers },
          deletedAt: null,
        },
      });
      if (existingAsset) {
        throw new BadRequestException(
          `Inventar raqamlaridan biri bazada allaqachon band: ${existingAsset.inventoryNumber}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        let product = await tx.product.findFirst({
          where: {
            name: item.name,
            productType: item.productType,
            deletedAt: null,
          },
          include: { inventory: true },
        });

        if (!product) {
          product = await tx.product.create({
            data: {
              name: item.name,
              productType: item.productType,
              unit: item.unit ?? 'DONA',
              year: item.year ?? null,
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

          // inventory ni qayta yuklaymiz
          product = await tx.product.findUnique({
            where: { id: product.id },
            include: { inventory: true },
          });
        }

        const updatedInventory = await tx.inventory.update({
          where: { productId: product!.id },
          data: {
            quantity: { increment: item.quantity },
            unitPrice: item.unitPrice,
            totalValue: { increment: item.quantity * item.unitPrice },
          },
        });

        // 2. Jihozlarni (Asset) avtomatik yaratish
        if (
          item.productType === ProductType.BERILADIGAN &&
          item.inventoryNumbers
        ) {
          for (let i = 0; i < item.inventoryNumbers.length; i++) {
            await tx.asset.create({
              data: {
                productId: product!.id,
                inventoryNumber: item.inventoryNumbers[i],
                serialNumber: item.serialNumbers?.[i] || null,
                status: 'ACTIVE',
                purchasePrice: item.unitPrice || null,
              },
            });
          }
        }

        await tx.operation.create({
          data: {
            type: 'STOCK_IN',
            quantity: item.quantity,
            productId: product!.id,
            performedById,
            documentNumber: item.documentNumber,
            note: item.note,
          },
        });

        results.push({
          productId: product!.id,
          name: product!.name,
          productType: product!.productType,
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

  async exportCsv(): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: {
        inventory: true,
        assets: {
          where: { deletedAt: null },
          include: {
            assignments: {
              where: { returnedAt: null },
              include: {
                user: { select: { fullName: true, username: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
        departmentAssets: {
          include: { department: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'Mahsulot nomi',
      'Turi',
      'O‘lchov birligi',
      'Inventar raqami',
      'Seriya raqami',
      'Holati',
      'Joylashuvi (Xodim/Bo‘lim)',
      'Biriktirilgan sana',
      'Ombordagi qoldiq (Sarflanadigan)',
      'Bo‘limlardagi qoldiq (Sarflanadigan)',
      'Birlik narxi (Sotib olingan narxi)',
      'Minimal chegara',
      'Tavsif',
    ];

    const csvRows = [headers.join(',')];

    for (const product of products) {
      const typeText =
        product.productType === ProductType.BERILADIGAN
          ? 'Jihoz (Asset)'
          : 'Sarflanadigan';
      const unitText = product.unit;
      const minLevelText = product.inventory?.minLevel ?? 0;
      const descText = product.description
        ? `"${product.description.replace(/"/g, '""')}"`
        : '';

      // 1. Agar SARFLANADIGAN bo'lsa
      if (product.productType === ProductType.SARFLANADIGAN) {
        const warehouseQty = product.inventory?.quantity ?? 0;
        const deptsQty = product.departmentAssets.reduce(
          (sum, da) => sum + da.quantity,
          0,
        );
        const unitPrice = product.inventory?.unitPrice
          ? product.inventory.unitPrice.toString()
          : '';

        const row = [
          `"${product.name.replace(/"/g, '""')}"`,
          typeText,
          unitText,
          '', // Inventar raqami yo'q
          '', // Seriya raqami yo'q
          warehouseQty > 0 ? 'Omborda mavjud' : 'Tugagan',
          '', // Joylashuv yo'q
          '', // Sana yo'q
          warehouseQty,
          deptsQty,
          unitPrice,
          minLevelText,
          descText,
        ];
        csvRows.push(row.join(','));
      }

      // 2. Agar BERILADIGAN jihoz bo'lsa
      if (product.productType === ProductType.BERILADIGAN) {
        if (product.assets.length > 0) {
          for (const asset of product.assets) {
            const activeAssignment = asset.assignments[0];
            let statusText = 'Omborda';
            let locationText = '';
            let assignedDateText = '';

            if (asset.status === 'WRITTEN_OFF') {
              statusText = 'Hisobdan chiqarilgan';
            } else if (activeAssignment) {
              if (activeAssignment.user) {
                statusText = 'Xodimga biriktirilgan';
                locationText = `"${activeAssignment.user.fullName} (${activeAssignment.user.username})"`;
              } else if (activeAssignment.department) {
                statusText = 'Bo‘limga biriktirilgan';
                locationText = `"${activeAssignment.department.name}"`;
              }
              assignedDateText = activeAssignment.assignedAt.toISOString();
            }

            const priceText = asset.purchasePrice
              ? asset.purchasePrice.toString()
              : product.inventory?.unitPrice
                ? product.inventory.unitPrice.toString()
                : '';

            const row = [
              `"${product.name.replace(/"/g, '""')}"`,
              typeText,
              unitText,
              `"${asset.inventoryNumber.replace(/"/g, '""')}"`,
              asset.serialNumber
                ? `"${asset.serialNumber.replace(/"/g, '""')}"`
                : '',
              statusText,
              locationText,
              assignedDateText,
              '', // Ombordagi qoldiq
              '', // Bo'limlardagi qoldiq
              priceText,
              minLevelText,
              descText,
            ];
            csvRows.push(row.join(','));
          }
        } else {
          const qty = product.inventory?.quantity ?? 0;
          const unitPrice = product.inventory?.unitPrice
            ? product.inventory.unitPrice.toString()
            : '';
          const row = [
            `"${product.name.replace(/"/g, '""')}"`,
            typeText,
            unitText,
            '',
            '',
            'Omborda (Jihozlar ro‘yxatga olinmagan)',
            '',
            '',
            qty,
            '',
            unitPrice,
            minLevelText,
            descText,
          ];
          csvRows.push(row.join(','));
        }
      }
    }

    return '\ufeff' + csvRows.join('\n');
  }
}
