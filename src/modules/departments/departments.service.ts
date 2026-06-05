import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, departmentAssets: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    return department;
  }

  async getStats(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException("Bo'lim topilmadi");
    }

    const [userCount, assetCount, consumableCount, sharedCount] = await Promise.all([
      this.prisma.user.count({
        where: { departmentId: id, deletedAt: null, isActive: true },
      }),
      this.prisma.assignment.count({
        where: {
          user: {
            departmentId: id,
            deletedAt: null,
          },
        },
      }),
      this.prisma.departmentAsset.aggregate({
        where: {
          departmentId: id,
          product: { productType: 'CONSUMABLE' },
        },
        _sum: { quantity: true },
      }),
      this.prisma.departmentAsset.aggregate({
        where: {
          departmentId: id,
          product: { productType: 'SHARED' },
        },
        _sum: { quantity: true },
      }),
    ]);

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      userCount,
      assetCount,
      consumableCount: consumableCount._sum.quantity ?? 0,
      sharedCount: sharedCount._sum.quantity ?? 0,
    };
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BadRequestException("Bu kod bilan bo'lim allaqachon mavjud");
    }

    return this.prisma.department.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.department.findUnique({
        where: { code: dto.code },
      });

      if (existing && existing.id !== id) {
        throw new BadRequestException("Bu kod bilan bo'lim allaqachon mavjud");
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const userCount = await this.prisma.user.count({
      where: { departmentId: id, deletedAt: null },
    });

    if (userCount > 0) {
      throw new BadRequestException(
        "Bo'limda xodimlar mavjud, o'chirib bo'lmaydi",
      );
    }

    const assetCount = await this.prisma.departmentAsset.count({
      where: { departmentId: id },
    });

    if (assetCount > 0) {
      throw new BadRequestException(
        "Bo'limda jihozlar mavjud, o'chirib bo'lmaydi",
      );
    }

    await this.prisma.department.delete({ where: { id } });

    return { message: "Bo'lim muvaffaqiyatli o'chirildi" };
  }
}
