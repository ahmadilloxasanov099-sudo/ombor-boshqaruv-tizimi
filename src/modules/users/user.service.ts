import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(query: UserQueryDto) {
    const { page = 1, limit = 20, search, departmentId, role } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(role && { role }),
      ...(departmentId && { departmentId }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { position: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          isActive: true,
          phone: true,
          position: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        position: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    return user;
  }

  async getAssignments(id: string) {
    await this.findOne(id);

    return this.prisma.assignment.findMany({
      where: { userId: id, returnedAt: null },
      include: {
        asset: {
          include: {
            product: {
              select: { id: true, name: true, productType: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async getHistory(id: string) {
    await this.findOne(id);

    return this.prisma.operation.findMany({
      where: {
        OR: [{ userId: id }, { fromUserId: id }, { performedById: id }],
      },
      include: {
        product: { select: { id: true, name: true } },
        asset: { select: { id: true, inventoryNumber: true } },
        department: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto, createdBy: string) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException('Bu username allaqachon mavjud');
    }

    const department = await this.prisma.department.findFirst({
      where: { id: dto.departmentId, deletedAt: null },
    });

    if (!department) {
      throw new BadRequestException("Bo'lim topilmadi");
    }

    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        position: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      tableName: 'User',
      recordId: user.id,
      newData: user,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string) {
    const oldUser = await this.findOne(id);

    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Bu username allaqachon mavjud');
      }
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, deletedAt: null },
      });
      if (!department) {
        throw new BadRequestException("Bo'lim topilmadi");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        position: true,
        departmentId: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: id,
      oldData: oldUser,
      newData: updatedUser,
    });

    return updatedUser;
  }

  async toggleStatus(id: string, updatedBy: string) {
    const user = await this.findOne(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        fullName: true,
        username: true,
        isActive: true,
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: id,
      oldData: { isActive: user.isActive },
      newData: { isActive: updated.isActive },
    });

    return updated;
  }

  async remove(id: string, deletedBy: string) {
    await this.findOne(id);

    const activeAssignments = await this.prisma.assignment.count({
      where: { userId: id, returnedAt: null },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        'Xodimda qaytarilmagan jihozlar bor, oldin ularni qaytarib oling!',
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      action: AuditAction.DELETE,
      tableName: 'User',
      recordId: id,
    });

    return { message: "Xodim muvaffaqiyatli o'chirildi" };
  }

  async bulkReturn(id: string, performedById: string) {
    await this.findOne(id);

    const assignments = await this.prisma.assignment.findMany({
      where: { userId: id, returnedAt: null },
      include: { asset: true },
    });

    if (assignments.length === 0) {
      throw new BadRequestException("Xodimda jihozlar yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.inventory.update({
          where: { productId: assignment.asset.productId },
          data: { quantity: { increment: 1 } },
        });

        await tx.operation.create({
          data: {
            type: 'RETURN_FROM_USER',
            quantity: 1,
            userId: id,
            assetId: assignment.assetId,
            productId: assignment.asset.productId,
            performedById,
            note: 'Ommaviy qaytarish',
          },
        });
      }

      return {
        message: `${assignments.length} ta jihoz muvaffaqiyatli qaytarildi`,
        count: assignments.length,
      };
    });
  }

  async bulkTransfer(id: string, toUserId: string, performedById: string) {
    await this.findOne(id);

    const toUser = await this.prisma.user.findFirst({
      where: { id: toUserId, deletedAt: null },
    });
    if (!toUser) throw new NotFoundException('Xodim topilmadi');

    if (id === toUserId) {
      throw new BadRequestException("Bir xil xodimga o'tkazib bo'lmaydi");
    }

    const assignments = await this.prisma.assignment.findMany({
      where: { userId: id, returnedAt: null },
      include: { asset: true },
    });

    if (assignments.length === 0) {
      throw new BadRequestException("Xodimda jihozlar yo'q");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await tx.assignment.update({
          where: { id: assignment.id },
          data: { returnedAt: new Date() },
        });

        await tx.assignment.create({
          data: { userId: toUserId, assetId: assignment.assetId },
        });

        await tx.operation.create({
          data: {
            type: 'TRANSFER_USER',
            quantity: 1,
            userId: toUserId,
            fromUserId: id,
            assetId: assignment.assetId,
            productId: assignment.asset.productId,
            performedById,
            note: "Ommaviy o'tkazish",
          },
        });
      }

      return {
        message: `${assignments.length} ta jihoz muvaffaqiyatli o'tkazildi`,
        count: assignments.length,
      };
    });
  }
}