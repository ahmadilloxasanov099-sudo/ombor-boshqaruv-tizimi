import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { ProductType } from '@prisma/client';
import { StockInDto } from './dto/stock-in.dto';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { WriteOffDto } from './dto/writeoff.dto';
import { BulkWriteOffDto } from './dto/bulk-write-off.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { MailService } from '../nodemailer/mail.service';
import { t } from 'src/common';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class OperationsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  private async checkStockAndAlert(productId: string) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { productId },
        include: { product: true },
      });

      if (
        inventory &&
        inventory.product &&
        inventory.quantity < inventory.minLevel
      ) {
        this.mailService
          .sendLowStockAlert(
            inventory.product.name,
            inventory.quantity,
            inventory.minLevel,
          )
          .catch((err) =>
            console.error('Failed to send stock alert email:', err),
          );
      }
    } catch (error) {
      console.error('Error checking stock level for email alert:', error);
    }
  }

  async stockIn(dto: StockInDto, performedById: string) {
    const performerUser = await this.prisma.user.findUnique({
      where: { id: performedById },
      select: { organizationId: true },
    });
    const performerOrgId = performerUser?.organizationId || null;

    if (dto.productType === ProductType.BERILADIGAN) {
      if (
        !dto.inventoryNumbers ||
        dto.inventoryNumbers.length !== dto.quantity
      ) {
        throw new BadRequestException(
          `Inventar raqamlari soni (${dto.inventoryNumbers?.length || 0}) kirim qilinayotgan miqdorga (${dto.quantity}) teng bo'lishi kerak`,
        );
      }

      const uniqueNumbers = new Set(dto.inventoryNumbers);
      if (uniqueNumbers.size !== dto.inventoryNumbers.length) {
        throw new BadRequestException(
          'Kiritilgan inventar raqamlari ichida takrorlanishlar mavjud!',
        );
      }

      const existingAsset = await this.prisma.asset.findFirst({
        where: {
          inventoryNumber: { in: dto.inventoryNumbers },
          organizationId: performerOrgId,
          deletedAt: null,
        },
      });

      if (existingAsset) {
        throw new BadRequestException(
          `Inventar raqamlaridan biri bazada allaqachon band: ${existingAsset.inventoryNumber}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let product = await tx.product.findFirst({
        where: {
          name: dto.name,
          productType: dto.productType,
          organizationId: performerOrgId,
          deletedAt: null,
        },
        include: { inventory: true },
      });

      if (!product) {
        product = await tx.product.create({
          data: {
            name: dto.name,
            productType: dto.productType,
            unit: dto.unit,
            year: dto.year,
            description: dto.description,
            imageUrl: dto.imageUrl,
            organizationId: performerOrgId,
          },
          include: { inventory: true },
        });

        await tx.inventory.create({
          data: {
            productId: product.id,
            quantity: 0,
            minLevel: dto.minLevel ?? 0,
            unitPrice: dto.unitPrice,
          },
        });
      }

      await tx.inventory.update({
        where: { productId: product.id },
        data: {
          quantity: { increment: dto.quantity },
          unitPrice: dto.unitPrice ?? undefined,
          totalValue: dto.unitPrice
            ? { increment: dto.unitPrice * dto.quantity }
            : undefined,
        },
      });

      if (dto.productType === ProductType.BERILADIGAN && dto.inventoryNumbers) {
        for (let i = 0; i < dto.inventoryNumbers.length; i++) {
          await tx.asset.create({
            data: {
              productId: product.id,
              inventoryNumber: dto.inventoryNumbers[i],
              serialNumber: dto.serialNumbers?.[i] || null,
              organizationId: performerOrgId,
              status: 'ACTIVE',
              purchasePrice: dto.unitPrice ?? null,
            },
          });
        }
      }

      await tx.operation.create({
        data: {
          type: 'STOCK_IN',
          quantity: dto.quantity,
          productId: product.id,
          performedById,
          documentNumber: dto.documentNumber,
          documentDate: dto.documentDate
            ? new Date(dto.documentDate)
            : undefined,
          note: dto.note,
          organizationId: performerOrgId,
        },
      });

      return tx.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
    });
  }

  async giveToUser(dto: GiveToUserDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    if (product.productType !== ProductType.BERILADIGAN) {
      const qtyToGive = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;
      const result = await this.prisma.$transaction(async (tx) => {
        const invUpdate = await tx.inventory.updateMany({
          where: { productId: dto.productId, quantity: { gte: qtyToGive } },
          data: { quantity: { decrement: qtyToGive } },
        });
        if (invUpdate.count === 0) {
          throw new BadRequestException("Omborda yetarli miqdorda TMZ yo'q");
        }

        await tx.operation.create({
          data: {
            type: 'GIVE_TO_USER',
            quantity: qtyToGive,
            userId: dto.userId,
            productId: dto.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
          },
        });

        return { message: `${product.name} (${qtyToGive} ${product.unit || 'dona'}) xodimga berildi` };
      });

      void this.checkStockAndAlert(dto.productId);
      return result;
    }

    if (!dto.inventoryNumber) {
      throw new BadRequestException("Asosiy vositalar uchun inventar raqami tanlanishi shart!");
    }

    const existingAsset = await this.prisma.asset.findUnique({
      where: { inventoryNumber: dto.inventoryNumber },
      include: { assignments: { where: { returnedAt: null } } },
    });

    if (!existingAsset) {
      throw new BadRequestException('Ushbu inventar raqami topilmadi. Avval omborga kirim qiling!');
    }

    if (existingAsset.productId !== dto.productId) {
      throw new BadRequestException(
        'Bu inventar raqami boshqa mahsulotga tegishli',
      );
    }
    if (existingAsset.status !== 'ACTIVE') {
      throw new BadRequestException('Bu jihoz faol holatda emas');
    }
    if (existingAsset.assignments.length > 0) {
      throw new BadRequestException(
        'Bu jihoz hozirda boshqa xodimga biriktirilgan',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const assetId = existingAsset.id;
      if (
        dto.serialNumber &&
        existingAsset.serialNumber !== dto.serialNumber
      ) {
        await tx.asset.update({
          where: { id: existingAsset.id },
          data: { serialNumber: dto.serialNumber },
        });
      }

      await tx.assignment.create({
        data: { userId: dto.userId, assetId },
      });

      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      await tx.operation.create({
        data: {
          type: 'GIVE_TO_USER',
          quantity: 1,
          userId: dto.userId,
          assetId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return tx.asset.findUnique({
        where: { id: assetId },
        include: {
          product: { select: { id: true, name: true } },
          assignments: {
            where: { returnedAt: null },
            include: { user: { select: { id: true, fullName: true } } },
          },
        },
      });
    });

    void this.checkStockAndAlert(dto.productId);
    return result;
  }

  async assignToDept(dto: AssignToDeptDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.BERILADIGAN) {
      throw new BadRequestException(
        "Faqat BERILADIGAN mahsulot bo'limga jihoz sifatida biriktiriladi",
      );
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException("Bo'lim topilmadi");

    const existingAsset = await this.prisma.asset.findUnique({
      where: { inventoryNumber: dto.inventoryNumber },
      include: { assignments: { where: { returnedAt: null } } },
    });

    if (!existingAsset) {
      throw new BadRequestException('Ushbu inventar raqami topilmadi. Avval omborga kirim qiling!');
    }

    if (existingAsset.productId !== dto.productId) {
      throw new BadRequestException(
        'Bu inventar raqami boshqa mahsulotga tegishli',
      );
    }
    if (existingAsset.status !== 'ACTIVE') {
      throw new BadRequestException('Bu jihoz faol holatda emas');
    }
    if (existingAsset.assignments.length > 0) {
      throw new BadRequestException(
        'Bu jihoz hozirda kimga yoki qaysi bo‘limga biriktirilgan',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const assetId = existingAsset.id;
      if (
        dto.serialNumber &&
        existingAsset.serialNumber !== dto.serialNumber
      ) {
        await tx.asset.update({
          where: { id: existingAsset.id },
          data: { serialNumber: dto.serialNumber },
        });
      }

      await tx.assignment.create({
        data: { departmentId: dto.departmentId, assetId },
      });

      await tx.departmentAsset.upsert({
        where: {
          departmentId_productId: {
            departmentId: dto.departmentId,
            productId: dto.productId,
          },
        },
        update: { quantity: { increment: 1 } },
        create: {
          departmentId: dto.departmentId,
          productId: dto.productId,
          quantity: 1,
        },
      });

      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      await tx.operation.create({
        data: {
          type: 'ASSIGN_TO_DEPT',
          quantity: 1,
          departmentId: dto.departmentId,
          assetId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return tx.asset.findUnique({
        where: { id: assetId },
        include: {
          product: { select: { id: true, name: true } },
          assignments: {
            where: { returnedAt: null },
            include: { department: { select: { id: true, name: true } } },
          },
        },
      });
    });

    void this.checkStockAndAlert(dto.productId);
    return result;
  }

  async returnFromUser(dto: ReturnFromUserDto, performedById: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, deletedAt: null },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    const assignment = await this.prisma.assignment.findFirst({
      where: { userId: dto.userId, assetId: dto.assetId, returnedAt: null },
    });
    if (!assignment) {
      throw new BadRequestException('Bu jihoz ushbu xodimda emas');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: new Date() },
      });

      await tx.inventory.update({
        where: { productId: asset.productId },
        data: { quantity: { increment: 1 } },
      });

      await tx.operation.create({
        data: {
          type: 'RETURN_FROM_USER',
          quantity: 1,
          userId: dto.userId,
          assetId: dto.assetId,
          productId: asset.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: 'Jihoz muvaffaqiyatli qaytarildi' };
    });
  }

  async transferUser(dto: TransferUserDto, performedById: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: dto.assetId, deletedAt: null },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    const assignment = await this.prisma.assignment.findFirst({
      where: { userId: dto.fromUserId, assetId: dto.assetId, returnedAt: null },
    });
    if (!assignment) {
      throw new BadRequestException("Bu jihoz ko'rsatilgan xodimda emas");
    }

    const toUser = await this.prisma.user.findFirst({
      where: { id: dto.toUserId, deletedAt: null },
    });
    if (!toUser) throw new NotFoundException('Xodim topilmadi');

    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException("Bir xil xodimga o'tkazib bo'lmaydi");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: new Date() },
      });

      await tx.assignment.create({
        data: { userId: dto.toUserId, assetId: dto.assetId },
      });

      await tx.operation.create({
        data: {
          type: 'TRANSFER_USER',
          quantity: 1,
          userId: dto.toUserId,
          fromUserId: dto.fromUserId,
          assetId: dto.assetId,
          productId: asset.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: "Jihoz muvaffaqiyatli o'tkazildi" };
    });
  }

  async giveToDept(dto: GiveToDeptDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.SARFLANADIGAN) {
      throw new BadRequestException(
        "Faqat SARFLANADIGAN mahsulot bo'limga beriladi",
      );
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException("Bo'lim topilmadi");

    const result = await this.prisma.$transaction(async (tx) => {
      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: dto.quantity } },
        data: { quantity: { decrement: dto.quantity } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      await tx.operation.create({
        data: {
          type: 'GIVE_TO_DEPT',
          quantity: dto.quantity,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: "Material bo'limga muvaffaqiyatli berildi" };
    });

    void this.checkStockAndAlert(dto.productId);
    return result;
  }

  async returnFromDept(dto: ReturnFromDeptDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (product.productType === ProductType.BERILADIGAN) {
      if (!dto.assetId) {
        throw new BadRequestException(
          'Jihozni qaytarish uchun assetId ko‘rsatilishi shart!',
        );
      }

      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, deletedAt: null },
      });
      if (!asset) throw new NotFoundException('Jihoz topilmadi');

      const assignment = await this.prisma.assignment.findFirst({
        where: {
          departmentId: dto.departmentId,
          assetId: dto.assetId,
          returnedAt: null,
        },
      });
      if (!assignment) {
        throw new BadRequestException(
          'Bu jihoz ushbu bo‘limga biriktirilmagan',
        );
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.departmentAsset.update({
          where: {
            departmentId_productId: {
              departmentId: dto.departmentId,
              productId: dto.productId,
            },
          },
          data: { quantity: { decrement: 1 } },
        });

        await tx.inventory.update({
          where: { productId: dto.productId },
          data: { quantity: { increment: 1 } },
        });

        await tx.operation.create({
          data: {
            type: 'RETURN_FROM_DEPT',
            quantity: 1,
            departmentId: dto.departmentId,
            assetId: dto.assetId,
            productId: dto.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
          },
        });

        return { message: "Jihoz bo'limdan muvaffaqiyatli qaytarildi" };
      });
    }

    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException(
        'Sarflanadigan materialni qaytarish uchun quantity 0 dan katta bo‘lishi shart!',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deptUpdate = await tx.departmentAsset.updateMany({
        where: {
          departmentId: dto.departmentId,
          productId: dto.productId,
          quantity: { gte: dto.quantity! },
        },
        data: { quantity: { decrement: dto.quantity! } },
      });
      if (deptUpdate.count === 0) {
        throw new BadRequestException("Bo'limda yetarli miqdor yo'q");
      }

      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { increment: dto.quantity! } },
      });

      await tx.operation.create({
        data: {
          type: 'RETURN_FROM_DEPT',
          quantity: dto.quantity!,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: "Material bo'limdan muvaffaqiyatli qaytarildi" };
    });
  }

  async writeOff(dto: WriteOffDto, performedById: string) {
    if (dto.assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: dto.assetId, deletedAt: null },
        include: {
          product: true,
          assignments: { where: { returnedAt: null } },
        },
      });
      if (!asset) throw new NotFoundException('Jihoz topilmadi');

      if (asset.assignments.length > 0) {
        throw new BadRequestException(
          'Jihoz xodimda bor, avval qaytarib oling',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: dto.assetId },
          data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
        });

        const invUpdate = await tx.inventory.updateMany({
          where: { productId: asset.productId, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 } },
        });
        if (invUpdate.count === 0) {
          throw new BadRequestException("Omborda yetarli miqdor yo'q");
        }

        await tx.operation.create({
          data: {
            type: 'WRITE_OFF',
            quantity: 1,
            assetId: dto.assetId,
            productId: asset.productId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
          },
        });

        return { message: 'Jihoz hisobdan chiqarildi' };
      });

      void this.checkStockAndAlert(asset.productId);
      return result;
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });
      if (!department) throw new NotFoundException("Bo'lim topilmadi");

      const result = await this.prisma.$transaction(async (tx) => {
        const deptAssetUpdate = await tx.departmentAsset.updateMany({
          where: {
            departmentId: dto.departmentId,
            productId: dto.productId,
            quantity: { gte: dto.quantity! },
          },
          data: { quantity: { decrement: dto.quantity! } },
        });

        if (deptAssetUpdate.count === 0) {
          throw new BadRequestException(
            "Bo'limda ushbu materialdan yetarli miqdor mavjud emas",
          );
        }

        await tx.operation.create({
          data: {
            type: 'WRITE_OFF',
            quantity: dto.quantity!,
            productId: dto.productId!,
            departmentId: dto.departmentId,
            performedById,
            documentNumber: dto.documentNumber,
            note: dto.note,
          },
        });

        return { message: "Material bo'limdan muvaffaqiyatli hisobdan chiqarildi" };
      });

      return result;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invUpdate = await tx.inventory.updateMany({
        where: { productId: dto.productId, quantity: { gte: dto.quantity! } },
        data: { quantity: { decrement: dto.quantity! } },
      });
      if (invUpdate.count === 0) {
        throw new BadRequestException("Omborda yetarli miqdor yo'q");
      }

      await tx.operation.create({
        data: {
          type: 'WRITE_OFF',
          quantity: dto.quantity!,
          productId: dto.productId!,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
          departmentId: dto.departmentId,
        },
      });

      return { message: 'Mahsulot hisobdan chiqarildi' };
    });

    void this.checkStockAndAlert(dto.productId!);
    return result;
  }

  async bulkWriteOff(dto: BulkWriteOffDto, performedById: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Hisobdan chiqarish uchun mahsulotlar tanlanishi kerak');
    }

    const docNum = dto.documentNumber || `DAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, deletedAt: null },
          include: { inventory: true },
        });

        if (!product) {
          throw new NotFoundException(`Mahsulot topilmadi: ${item.productId}`);
        }

        if (product.productType === ProductType.BERILADIGAN) {
          if (item.assetId) {
            const asset = await tx.asset.findFirst({
              where: { id: item.assetId, deletedAt: null },
              include: { assignments: { where: { returnedAt: null } } },
            });
            if (!asset) {
              throw new NotFoundException(`Jihoz topilmadi: ${item.assetId}`);
            }
            if (asset.assignments.length > 0) {
              throw new BadRequestException(`"${product.name}" jihozi xodimga biriktirilgan, avval qaytarib oling`);
            }

            await tx.asset.update({
              where: { id: item.assetId },
              data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
            });

            const invUpdate = await tx.inventory.updateMany({
              where: { productId: product.id, quantity: { gte: 1 } },
              data: { quantity: { decrement: 1 } },
            });
            if (invUpdate.count === 0) {
              throw new BadRequestException(`"${product.name}" mahsulotidan omborda yetarli miqdor yo'q`);
            }

            await tx.operation.create({
              data: {
                type: 'WRITE_OFF',
                quantity: 1,
                assetId: item.assetId,
                productId: product.id,
                performedById,
                documentNumber: docNum,
                note: dto.note,
              },
            });
          } else {
            const assets = await tx.asset.findMany({
              where: {
                productId: product.id,
                deletedAt: null,
                status: 'ACTIVE',
                assignments: { none: { returnedAt: null } },
              },
              take: item.quantity,
            });

            if (assets.length < item.quantity) {
              throw new BadRequestException(
                `"${product.name}" jihozida omborda yetarli miqdor yo'q (Mavjud: ${assets.length}, So'ralgan: ${item.quantity})`
              );
            }

            for (const asset of assets) {
              await tx.asset.update({
                where: { id: asset.id },
                data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
              });

              await tx.operation.create({
                data: {
                  type: 'WRITE_OFF',
                  quantity: 1,
                  assetId: asset.id,
                  productId: product.id,
                  performedById,
                  documentNumber: docNum,
                  note: dto.note,
                },
              });
            }

            const invUpdate = await tx.inventory.updateMany({
              where: { productId: product.id, quantity: { gte: item.quantity } },
              data: { quantity: { decrement: item.quantity } },
            });
            if (invUpdate.count === 0) {
              throw new BadRequestException(`"${product.name}" mahsulotidan omborda yetarli miqdor yo'q`);
            }
          }
        } else {
          const invUpdate = await tx.inventory.updateMany({
            where: { productId: product.id, quantity: { gte: item.quantity } },
            data: { quantity: { decrement: item.quantity } },
          });
          if (invUpdate.count === 0) {
            throw new BadRequestException(`"${product.name}" materialidan omborda yetarli miqdor yo'q`);
          }

          await tx.operation.create({
            data: {
              type: 'WRITE_OFF',
              quantity: item.quantity,
              productId: product.id,
              performedById,
              documentNumber: docNum,
              note: dto.note,
            },
          });
        }
      }

      return { message: 'Belgilangan mahsulotlar muvaffaqiyatli hisobdan chiqarildi', documentNumber: docNum };
    });

    for (const item of dto.items) {
      void this.checkStockAndAlert(item.productId);
    }

    return result;
  }

  async generatePdfAct(id: string): Promise<Buffer> {
    const operation = await this.prisma.operation.findUnique({
      where: { id },
      include: {
        product: true,
        asset: true,
        user: { include: { department: true } },
        department: true,
        performedBy: true,
      },
    });

    if (!operation) {
      throw new NotFoundException(t('errors.OPERATION_NOT_FOUND', {}, 'Operatsiya topilmadi'));
    }

    const lang = I18nContext.current()?.lang || 'uz';
    const dateStr = operation.createdAt.toLocaleDateString(
      lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
    );

    const relatedOperations = operation.documentNumber
      ? await this.prisma.operation.findMany({
          where: {
            documentNumber: operation.documentNumber,
            type: operation.type,
          },
          include: {
            product: true,
            asset: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [operation];

    const tableRows = relatedOperations.map((op, idx) => {
      const unitVal = op.product?.unit;
      const unitText = unitVal ? (t(`common.units.${unitVal}`) || unitVal) : t('pdf.unit_ta', {}, 'ta');
      return `
        <tr>
          <td class="center" style="text-align: center;">${idx + 1}</td>
          <td>${op.product?.name || t('pdf.unknown_product', {}, 'Noma‘lum mahsulot')}</td>
          <td>${op.asset?.inventoryNumber || '—'}</td>
          <td>${op.asset?.serialNumber || '—'}</td>
          <td class="center" style="text-align: center;">${op.quantity} ${unitText}</td>
        </tr>
      `;
    }).join('');

    let actTitle = t('pdf.title_give_user', {}, 'QABUL QILISH - TOPSHIRISH DALOLATNOMASI');
    let giverTitle = t('pdf.role_giver_give', {}, 'Topshirdi (Mas’ul shaxs)');
    let receiverTitle = t('pdf.role_receiver_give', {}, 'Qabul qildi');
    
    let giverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
    let receiverName = '';
    let departmentName = '';

    if (operation.type === 'GIVE_TO_USER' || operation.type === 'TRANSFER_USER') {
      receiverName = operation.user?.fullName || '';
      departmentName = operation.user?.department?.name || '';
    } else if (operation.type === 'RETURN_FROM_USER') {
      actTitle = t('pdf.title_return_user', {}, 'JIHOZNI OMBORGA QAYTARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_return', {}, 'Topshirdi (Xodim)');
      receiverTitle = t('pdf.role_receiver_return', {}, 'Qabul qildi (Ombor mudiri)');
      giverName = operation.user?.fullName || '';
      receiverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
      departmentName = operation.user?.department?.name || '';
    } else if (operation.type === 'ASSIGN_TO_DEPT' || operation.type === 'GIVE_TO_DEPT') {
      receiverName = t('pdf.receiver_default_name', {}, 'Bo‘lim mas’ul vakili');
      departmentName = operation.department?.name || '';
    } else if (operation.type === 'RETURN_FROM_DEPT') {
      actTitle = t('pdf.title_return_dept', {}, 'BO‘LIMDAN OMBORGA QAYTARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_dept_return', {}, 'Topshirdi (Bo‘lim)');
      receiverTitle = t('pdf.role_receiver_dept_return', {}, 'Qabul qildi (Ombor mudiri)');
      giverName = operation.department?.name || '';
      receiverName = operation.performedBy?.fullName || t('pdf.giver_default_name', {}, 'Ombor mudiri');
    } else if (operation.type === 'WRITE_OFF') {
      actTitle = t('pdf.title_write_off', {}, 'JIHOZ / MATERIALNI HISOBDAN CHIQARISH DALOLATNOMASI');
      giverTitle = t('pdf.role_giver_write_off', {}, 'Tasdiqladi (Admin)');
      receiverTitle = t('pdf.role_receiver_write_off', {}, 'Hisobdan chiqarildi (Utilizatsiya)');
      giverName = operation.performedBy?.fullName || t('pdf.admin_default_name', {}, 'Tizim Administratori');
      receiverName = t('pdf.write_off_location', {}, 'Ombor hisobidan o‘chirildi');
    }

    const docNum = operation.documentNumber || `DAL-${operation.id.slice(0, 8).toUpperCase()}`;
    const deptText = departmentName ? `(${t('pdf.dept_label', {}, 'Bo\'lim')}: ${departmentName})` : '';

    const descriptionText = t('pdf.description_give', {
      giverName,
      receiverName,
      deptText,
    }, `Ushbu dalolatnoma bir tomondan topshiruvchi <strong>${giverName}</strong>, ikkinchi tomondan qabul qiluvchi <strong>${receiverName}</strong> ${deptText} o'rtasida tuzildi. Mazkur hujjat orqali quyidagi tovar-moddiy boyliklar (TMB) rasmiylashtirildi:`);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            margin: 40px;
            font-size: 14px;
            color: #000;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .doc-meta {
            width: 100%;
            margin-bottom: 20px;
            border-bottom: 1px solid #000;
            padding-bottom: 10px;
          }
          .doc-meta td {
            font-size: 14px;
          }
          .text-right {
            text-align: right;
          }
          .content-text {
            text-indent: 50px;
            text-align: justify;
            margin-bottom: 25px;
          }
          .table-title {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 15px;
          }
          table.items {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          table.items th, table.items td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          table.items th {
            background-color: #f2f2f2;
            font-weight: bold;
            text-align: center;
          }
          table.items td.center {
            text-align: center;
          }
          .signatures {
            width: 100%;
            margin-top: 50px;
          }
          .signatures td {
            width: 50%;
            vertical-align: top;
          }
          .sig-line {
            margin-top: 40px;
            border-top: 1px solid #000;
            width: 80%;
            text-align: center;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${t('pdf.system_title', {}, 'TASHKILOT OMBOR TIZIMI (WMS)')}</h2>
          <h2 style="margin-top: 5px;">${actTitle}</h2>
        </div>

        <table class="doc-meta">
          <tr>
            <td><strong>${t('pdf.doc_number', {}, 'Hujjat №')}:</strong> ${docNum}</td>
            <td class="text-right"><strong>${t('pdf.date', {}, 'Sana')}:</strong> ${dateStr}</td>
          </tr>
        </table>

        <div class="content-text">
          ${descriptionText}
        </div>

        <div class="table-title">${t('pdf.table_title', {}, 'Topshirilgan Tovar-Moddiy Boyliklar ro\'yxati:')}</div>
        <table class="items">
          <thead>
            <tr>
              <th style="width: 5%;">${t('pdf.col_no', {}, '№')}</th>
              <th style="width: 45%;">${t('pdf.col_name', {}, 'Mahsulot nomi')}</th>
              <th style="width: 20%;">${t('pdf.col_inv', {}, 'Inventar raqami')}</th>
              <th style="width: 15%;">${t('pdf.col_serial', {}, 'Seriya raqami')}</th>
              <th style="width: 15%;">${t('pdf.col_qty', {}, 'Soni (O\'lchov)')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="content-text" style="margin-top: 20px;">
          ${t('pdf.footer_text', {}, 'Topshirilgan tovar-moddiy boyliklar to‘liq holatda, soz, butun va talabga javob beradigan darajada topshirildi. Tomonlarning bir-biriga nisbatan e‘tirozlari mavjud emas.')}
        </div>

        <table class="signatures">
          <tr>
            <td>
              <strong>${giverTitle}:</strong>
              <div class="sig-line">
                (${t('pdf.signature_label', {}, 'imzo, sana')})<br><br>
                <strong>${giverName}</strong>
              </div>
            </td>
            <td>
              <strong>${receiverTitle}:</strong>
              <div class="sig-line">
                (${t('pdf.signature_label', {}, 'imzo, sana')})<br><br>
                <strong>${receiverName}</strong>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
}
