import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll() {
    return this.prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        users: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            fullName: true,
            username: true,
            position: true,
          },
        },
        departmentAssets: {
          include: {
            product: { select: { id: true, name: true, productType: true, unit: true } },
          },
        },
        assignments: {
          where: { returnedAt: null },
          include: {
            asset: {
              include: {
                product: { select: { id: true, name: true, productType: true } },
              },
            },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    return department;
  }

  async getStats(id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    const [userCount, assetCount, sarflanadigan] = await Promise.all([
      this.prisma.user.count({
        where: { departmentId: id, deletedAt: null, isActive: true },
      }),
      this.prisma.assignment.count({
        where: {
          returnedAt: null,
          user: { departmentId: id, deletedAt: null },
        },
      }),
      this.prisma.departmentAsset.aggregate({
        where: {
          departmentId: id,
          product: { productType: 'SARFLANADIGAN', deletedAt: null },
        },
        _sum: { quantity: true },
      }),
    ]);

    return {
      id: department.id,
      name: department.name,
      userCount,
      assetCount,
      sarflanadigan: sarflanadigan._sum.quantity ?? 0,
    };
  }

  async create(dto: CreateDepartmentDto, createdBy: string) {
    const existing = await this.prisma.department.findFirst({
      where: { name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new BadRequestException("Bu nomdagi bo'lim allaqachon mavjud");
    }

    const department = await this.prisma.department.create({
      data: dto,
    });

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      tableName: 'Department',
      recordId: department.id,
      newData: department,
    });

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, updatedBy: string) {
    const oldDepartment = await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.department.findFirst({
        where: { name: dto.name, deletedAt: null },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException("Bu nomdagi bo'lim allaqachon mavjud");
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      tableName: 'Department',
      recordId: id,
      oldData: oldDepartment,
      newData: updated,
    });

    return updated;
  }

  async remove(id: string, deletedBy: string) {
    const department = await this.findOne(id);

    const userCount = await this.prisma.user.count({
      where: { departmentId: id, deletedAt: null },
    });

    if (userCount > 0) {
      throw new BadRequestException(
        "Bo'limda xodimlar mavjud, o'chirib bo'lmaydi",
      );
    }

    // FIX: Only block deletion if there are active assets (quantity > 0)
    const assetCount = await this.prisma.departmentAsset.count({
      where: {
        departmentId: id,
        quantity: { gt: 0 },
      },
    });

    if (assetCount > 0) {
      throw new BadRequestException(
        "Bo'limda jihozlar mavjud, o'chirib bo'lmaydi",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: AuditAction.DELETE,
          tableName: 'Department',
          recordId: id,
        },
      });

      return { message: "Bo'lim muvaffaqiyatli o'chirildi" };
    });
  }
}