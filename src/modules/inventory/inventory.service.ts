import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { SetMinLevelDto } from './dto/set-min-level.dto';
import { BulkStockInDto } from './dto';
import { ProductType, UnitType } from '@prisma/client';
import * as xlsx from 'xlsx';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(targetOrgId?: string, currentUser?: any) {
    let orgFilter: any = {};

    if (targetOrgId) {
      if (!currentUser || currentUser.organizationId === targetOrgId || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'VAZIRLIK_OMBORCHI') {
        orgFilter = {
          OR: [
            { organizationId: targetOrgId },
            { organizationId: null },
          ],
        };
      } else {
        orgFilter = { organizationId: targetOrgId };
      }
    }

    const items = await this.prisma.inventory.findMany({
      where: {
        product: {
          deletedAt: null,
          ...orgFilter,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            assets: {
              where: { deletedAt: null },
              select: {
                inventoryNumber: true,
                serialNumber: true,
              },
            },
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
    const inventory = await this.prisma.inventory.findFirst({
      where: {
        productId,
        product: {
          deletedAt: null,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            productType: true,
            unit: true,
            imageUrl: true,
            assets: {
              where: {
                deletedAt: null,
                status: 'ACTIVE',
                assignments: { none: { returnedAt: null } },
              },
              select: {
                id: true,
                inventoryNumber: true,
                serialNumber: true,
              },
            },
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

  async importExcel(fileBuffer: Buffer, performedById: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException("Excel fayli bo'sh yoki topilmadi");
    }

    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xls fayl kiriting.");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException("Excel varaqlari bo'sh");
    }

    // Smart Column Header Finder
    let headerRowIndex = -1;
    let nameCol = -1;
    let invNumberCol = -1;
    let unitCol = -1;
    let qtyCol = -1;
    let priceCol = -1;

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").toLowerCase().trim();

        if ((val.includes("наименовани") || val.includes("mahsulot") || val.includes("nomi") || val.includes("объекта")) && nameCol === -1) {
          nameCol = c;
          headerRowIndex = r;
        }
        if ((val.includes("инвентар") || val.includes("inv") || val.includes("номер")) && invNumberCol === -1) {
          invNumberCol = c;
        }
        if ((val.includes("ед") || val.includes("birlik") || val.includes("изм")) && unitCol === -1) {
          unitCol = c;
        }
        if ((val.includes("кол") || val.includes("soni") || val.includes("микдор") || val.includes("наличие")) && qtyCol === -1) {
          qtyCol = c;
        }
        if ((val.includes("сумма") || val.includes("narx") || val.includes("qiymat") || val.includes("сум")) && priceCol === -1) {
          priceCol = c;
        }
      }

      if (nameCol !== -1 && (invNumberCol !== -1 || qtyCol !== -1 || priceCol !== -1)) {
        break;
      }
    }

    // Fallback column positions matching both 7-column and 10-column Excel formats if header text was not found
    const firstRowLength = (rawRows[0] && Array.isArray(rawRows[0])) ? rawRows[0].length : 7;
    const isSevenColFormat = firstRowLength <= 8;

    if (nameCol === -1) nameCol = 1;
    if (invNumberCol === -1) invNumberCol = 3;
    if (unitCol === -1) unitCol = 4;
    if (qtyCol === -1) qtyCol = isSevenColFormat ? 5 : 6;
    if (priceCol === -1) priceCol = isSevenColFormat ? 6 : 7;

    const documentNumber = `IMP-EXCEL-${Date.now().toString().slice(-6)}`;
    let importedCount = 0;
    let totalQtyCount = 0;
    let totalSumValue = 0;
    const errors: string[] = [];

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawName = String(row[nameCol] || "").trim();
      const colZero = String(row[0] || "").toLowerCase().trim();
      const colOne = String(row[1] || "").toLowerCase().trim();

      // Skip non-data rows (headers, subheaders, numbers row 1..10, total summaries, signatures)
      if (
        !rawName ||
        rawName === "1" ||
        rawName === "2" ||
        colOne === "2" ||
        rawName.toLowerCase().startsWith("№") ||
        rawName.toLowerCase().startsWith("итого") ||
        rawName.toLowerCase().startsWith("председатель") ||
        rawName.toLowerCase().startsWith("члены") ||
        rawName.toLowerCase().startsWith("общее") ||
        rawName.toLowerCase().startsWith("все ценности") ||
        rawName.toLowerCase().startsWith("материальное") ||
        colZero.startsWith("итого") ||
        colZero.startsWith("председатель") ||
        colZero.startsWith("члены") ||
        rawName.toLowerCase().includes("наименование")
      ) {
        continue;
      }

      const invNumberRaw = String(row[invNumberCol] || "").trim();
      const unitRaw = String(row[unitCol] || "").trim().toLowerCase();

      // Clean Quantity (removes spaces, non-breaking spaces \u00a0, converts commas)
      let qtyStr = String(row[qtyCol] || "1").replace(/[\s\u00a0]+/g, "").replace(",", ".");
      let quantity = Math.max(1, parseInt(qtyStr, 10) || 1);

      // Clean Price/Sum (removes spaces, non-breaking spaces \u00a0, converts commas)
      let priceStr = String(row[priceCol] || "0").replace(/[\s\u00a0]+/g, "").replace(",", ".");
      let sumValue = parseFloat(priceStr) || 0;
      let unitPrice = sumValue > 0 ? (sumValue > quantity ? sumValue / quantity : sumValue) : 0;

      // Map Unit
      let unit: UnitType = UnitType.DONA;
      if (unitRaw.includes('komplekt') || unitRaw.includes('компл')) {
        unit = UnitType.KOMPLEKT;
      } else if (unitRaw.includes('pachka') || unitRaw.includes('пачк')) {
        unit = UnitType.PACHKA;
      }

      // Determine product type (If inventory number exists or qty == 1 => BERILADIGAN, else SARFLANADIGAN)
      const isAsset = invNumberRaw.length > 3 || (quantity === 1 && !unitRaw.includes('komplekt'));
      const productType = isAsset ? ProductType.BERILADIGAN : ProductType.SARFLANADIGAN;

      try {
        await this.prisma.$transaction(async (tx) => {
          let product = await tx.product.findFirst({
            where: { name: rawName, deletedAt: null },
          });

          if (!product) {
            product = await tx.product.create({
              data: {
                name: rawName,
                productType,
                unit,
                organizationId: performerOrgId,
              },
            });
          }

          let inventory = await tx.inventory.findUnique({
            where: { productId: product.id },
          });

          if (!inventory) {
            inventory = await tx.inventory.create({
              data: {
                productId: product.id,
                quantity,
                unitPrice,
              },
            });
          } else {
            inventory = await tx.inventory.update({
              where: { productId: product.id },
              data: {
                quantity: { increment: quantity },
                unitPrice: unitPrice > 0 ? unitPrice : inventory.unitPrice,
              },
            });
          }

          let createdAssetId: string | undefined = undefined;
          if (productType === ProductType.BERILADIGAN) {
            const invNumber = invNumberRaw || `${product.id.slice(0, 4)}-${Date.now().toString().slice(-6)}-${i}`;
            
            const existingAsset = await tx.asset.findUnique({
              where: { inventoryNumber: invNumber },
            });

            if (!existingAsset) {
              const asset = await tx.asset.create({
                data: {
                  productId: product.id,
                  inventoryNumber: invNumber,
                  purchasePrice: unitPrice > 0 ? unitPrice : undefined,
                  status: 'ACTIVE',
                  organizationId: performerOrgId,
                },
              });
              createdAssetId = asset.id;
            }
          }

          await tx.operation.create({
            data: {
              type: 'STOCK_IN',
              quantity,
              productId: product.id,
              assetId: createdAssetId,
              performedById,
              documentNumber,
              note: `Excel orqali ommaviy kirim (${sheetName})`,
              organizationId: performerOrgId,
            },
          });
        });

        importedCount++;
        totalQtyCount += quantity;
        totalSumValue += sumValue;
      } catch (err: any) {
        console.error(`Row ${i} import error:`, err);
        errors.push(`Qator ${i + 1} (${rawName}): ${err.message}`);
      }
    }

    return {
      message: `${importedCount} ta mahsulot muvaffaqiyatli kirim qilindi!`,
      importedCount,
      totalQtyCount,
      totalSumValue,
      documentNumber,
      errorCount: errors.length,
      errors: errors.slice(0, 5),
    };
  }
}
