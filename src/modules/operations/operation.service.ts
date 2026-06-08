import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { GiveToUserDto } from './dto/give-to-user.dto';
import { ReturnFromUserDto } from './dto/return-from-user.dto';
import { TransferUserDto } from './dto/transfer-user.dto';
import { GiveToDeptDto } from './dto/give-to-dept.dto';
import { AssignToDeptDto } from './dto/assign-to-dept.dto';
import { ReturnFromDeptDto } from './dto/return-from-dept.dto';
import { ProductType } from '@prisma/client';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  // GIVE_TO_USER — xodimga jihoz berish (ASSET)
  async giveToUser(dto: GiveToUserDto, performedById: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });

    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.ASSET) {
      throw new BadRequestException('Faqat ASSET turli mahsulot xodimga beriladi');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Xodim topilmadi');

    if (!product.inventory || product.inventory.quantity < 1) {
      throw new BadRequestException('Ombordа yetarli miqdor yo\'q');
    }

    const existingAsset = await this.prisma.asset.findUnique({
      where: { inventoryNumber: dto.inventoryNumber },
      include: { assignments: true },
    });

    if (existingAsset) {
      if (existingAsset.productId !== dto.productId) {
        throw new BadRequestException('Bu inventar raqami boshqa mahsulotga tegishli');
      }
      if (existingAsset.status !== 'ACTIVE') {
        throw new BadRequestException('Bu jihoz faol holatda emas (singan, yo\'qolgan yoki hisobdan chiqarilgan)');
      }
      if (existingAsset.assignments.length > 0) {
        throw new BadRequestException('Bu jihoz hozirda boshqa xodimga biriktirilgan');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let assetId: string;

      if (!existingAsset) {
        const newAsset = await tx.asset.create({
          data: {
            productId: dto.productId,
            inventoryNumber: dto.inventoryNumber,
            code: dto.inventoryNumber,
            serialNumber: dto.serialNumber,
            status: 'ACTIVE',
            purchasePrice: product.inventory?.unitPrice ?? null,
          },
        });
        assetId = newAsset.id;
      } else {
        assetId = existingAsset.id;
        if (dto.serialNumber && existingAsset.serialNumber !== dto.serialNumber) {
          const updated = await tx.asset.update({
            where: { id: existingAsset.id },
            data: { serialNumber: dto.serialNumber },
          });
          assetId = updated.id;
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
      });
    });
  }

  // RETURN_FROM_USER — xodimdan jihoz qaytarish
  async returnFromUser(dto: ReturnFromUserDto, performedById: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    const assignment = await this.prisma.assignment.findUnique({
      where: { userId_assetId: { userId: dto.userId, assetId: dto.assetId } },
    });
    if (!assignment) {
      throw new BadRequestException('Bu jihoz ushbu xodimda emas');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.delete({
        where: { userId_assetId: { userId: dto.userId, assetId: dto.assetId } },
      });

      await tx.asset.update({
        where: { id: dto.assetId },
        data: { status: 'ACTIVE' },
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
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: { product: true },
    });
    if (!asset) throw new NotFoundException('Jihoz topilmadi');

    const assignment = await this.prisma.assignment.findUnique({
      where: { userId_assetId: { userId: dto.fromUserId, assetId: dto.assetId } },
    });
    if (!assignment) {
      throw new BadRequestException('Bu jihoz ko\'rsatilgan xodimda emas');
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: dto.toUserId, deletedAt: null },
    });
    if (!toUser) throw new NotFoundException('Xodim topilmadi');

    return this.prisma.$transaction(async (tx) => {
      await tx.assignment.delete({
        where: { userId_assetId: { userId: dto.fromUserId, assetId: dto.assetId } },
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

      return { message: 'Jihoz muvaffaqiyatli o\'tkazildi' };
    });
  }

  // GIVE_TO_DEPT — bo'limga material berish (CONSUMABLE)
  async giveToDept(dto: GiveToDeptDto, performedById: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.CONSUMABLE) {
      throw new BadRequestException('kechirasz bu turdagi mahsulotni bolimga sriflash uchun berb yuborb bolmaydi');
    }

    if (!product.inventory || product.inventory.quantity < dto.quantity) {
      throw new BadRequestException('Omborда yetarli miqdor yo\'q');
    }

    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department) throw new NotFoundException('Bo\'lim topilmadi');

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

      return { message: 'Material bo\'limga muvaffaqiyatli berildi' };
    });
  }

  // ASSIGN_TO_DEPT — bo'limga umumiy jihoz (SHARED)
  async assignToDept(dto: AssignToDeptDto, performedById: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.SHARED) {
      throw new BadRequestException('Faqat SHARED turli mahsulot bo\'limga biriktiriladi');
    }

    if (!product.inventory || product.inventory.quantity < dto.quantity) {
      throw new BadRequestException('Ombordа yetarli miqdor yo\'q');
    }

    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department) throw new NotFoundException('Bo\'lim topilmadi');

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
          type: 'ASSIGN_TO_DEPT',
          quantity: dto.quantity,
          departmentId: dto.departmentId,
          productId: dto.productId,
          performedById,
          documentNumber: dto.documentNumber,
          note: dto.note,
        },
      });

      return { message: 'Jihoz bo\'limga muvaffaqiyatli biriktirildi' };
    });
  }

  // RETURN_FROM_DEPT — bo'limdan jihoz qaytarish
  async returnFromDept(dto: ReturnFromDeptDto, performedById: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, deletedAt: null },
      include: { inventory: true },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    if (product.productType !== ProductType.SHARED) {
      throw new BadRequestException('Faqat SHARED (umumiy foydalanishdagi) jihozlarni bo\'limdan qaytarish mumkin');
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
      throw new BadRequestException('Bo\'limda yetarli miqdor yo\'q');
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

      return { message: 'Jihoz bo\'limdan muvaffaqiyatli qaytarildi' };
    });
  }
}