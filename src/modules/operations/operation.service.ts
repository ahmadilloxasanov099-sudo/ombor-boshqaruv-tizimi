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

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  // STOCK_IN — omborga kirim (Product avtomatik yaratiladi)
  async stockIn(dto: StockInDto, performedById: string) {
    return this.prisma.$transaction(async (tx) => {
      let product = await tx.product.findFirst({
        where: { name: dto.name, productType: dto.productType, deletedAt: null },
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

      await tx.operation.create({
        data: {
          type: 'STOCK_IN',
          quantity: dto.quantity,
          productId: product.id,
          performedById,
          documentNumber: dto.documentNumber,
          documentDate: dto.documentDate,
          note: dto.note,
        },
      });

      return tx.product.findUnique({
        where: { id: product.id },
        include: { inventory: true },
      });
    });
  }

  // GIVE_TO_USER — xodimga BERILADIGAN mahsulot berish
  async giveToUser(dto: GiveToUserDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.BERILADIGAN) {
      throw new BadRequestException(
        "Faqat BERILADIGAN mahsulot xodimga beriladi",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    if (!product.inventory || product.inventory.quantity < 1) {
      throw new BadRequestException("Omborda yetarli miqdor yo'q");
    }

    const existingAsset = await this.prisma.asset.findUnique({
      where: { inventoryNumber: dto.inventoryNumber },
      include: { assignments: { where: { returnedAt: null } } },
    });

    if (existingAsset) {
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
    }

    return this.prisma.$transaction(async (tx) => {
      let assetId: string;

      if (!existingAsset) {
        const newAsset = await tx.asset.create({
          data: {
            productId: dto.productId,
            inventoryNumber: dto.inventoryNumber,
            serialNumber: dto.serialNumber,
            status: 'ACTIVE',
            purchasePrice: product.inventory?.unitPrice ?? null,
          },
        });
        assetId = newAsset.id;
      } else {
        assetId = existingAsset.id;
        if (dto.serialNumber && existingAsset.serialNumber !== dto.serialNumber) {
          await tx.asset.update({
            where: { id: existingAsset.id },
            data: { serialNumber: dto.serialNumber },
          });
        }
      }

      await tx.assignment.create({
        data: { userId: dto.userId, assetId },
      });

      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { decrement: 1 } },
      });

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
  }

  // RETURN_FROM_USER — xodimdan jihoz qaytarish
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

  // TRANSFER_USER — bir xodimdan ikkinchisiga
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

  // GIVE_TO_DEPT — bo'limga SARFLANADIGAN berish
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

    if (!product.inventory || product.inventory.quantity < dto.quantity) {
      throw new BadRequestException("Omborda yetarli miqdor yo'q");
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });
    if (!department) throw new NotFoundException("Bo'lim topilmadi");

    return this.prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { decrement: dto.quantity } },
      });

      await tx.departmentAsset.upsert({
        where: {
          departmentId_productId: {
            departmentId: dto.departmentId,
            productId: dto.productId,
          },
        },
        update: { quantity: { increment: dto.quantity } },
        create: {
          departmentId: dto.departmentId,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });

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
  }

  // RETURN_FROM_DEPT — bo'limdan qaytarish
  async returnFromDept(dto: ReturnFromDeptDto, performedById: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.SARFLANADIGAN) {
      throw new BadRequestException(
        "Faqat SARFLANADIGAN mahsulotni bo'limdan qaytarish mumkin",
      );
    }

    const departmentAsset = await this.prisma.departmentAsset.findUnique({
      where: {
        departmentId_productId: {
          departmentId: dto.departmentId,
          productId: dto.productId,
        },
      },
    });

    if (!departmentAsset || departmentAsset.quantity < dto.quantity) {
      throw new BadRequestException("Bo'limda yetarli miqdor yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.departmentAsset.update({
        where: {
          departmentId_productId: {
            departmentId: dto.departmentId,
            productId: dto.productId,
          },
        },
        data: { quantity: { decrement: dto.quantity } },
      });

      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { increment: dto.quantity } },
      });

      await tx.operation.create({
        data: {
          type: 'RETURN_FROM_DEPT',
          quantity: dto.quantity,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: "Jihoz bo'limdan muvaffaqiyatli qaytarildi" };
    });
  }

  // WRITE_OFF — hisobdan chiqarish
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
          "Jihoz xodimda bor, avval qaytarib oling",
        );
      }

      return this.prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: dto.assetId },
          data: { status: 'WRITTEN_OFF', deletedAt: new Date() },
        });

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
    }

    // SARFLANADIGAN hisobdan chiqarish
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    if (!product.inventory || product.inventory.quantity < dto.quantity!) {
      throw new BadRequestException("Omborda yetarli miqdor yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { productId: dto.productId },
        data: { quantity: { decrement: dto.quantity! } },
      });

      await tx.operation.create({
        data: {
          type: 'WRITE_OFF',
          quantity: dto.quantity!,
          productId: dto.productId!,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: 'Mahsulot hisobdan chiqarildi' };
    });
  }
}