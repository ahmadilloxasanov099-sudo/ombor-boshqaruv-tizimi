import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
          email: true,
          position: true,
          departmentId: true,
          department: { select: { id: true, name: true, code: true } },
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
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        email: true,
        position: true,
        departmentId: true,
        department: { select: { name: true, code: true } },
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
      where: { userId: id },
      include: {
        asset: {
          include: {
            product: {
              select: { id: true, name: true, code: true, productType: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHistory(id: string) {
    await this.findOne(id);

    return this.prisma.operation.findMany({
      where: {
        OR: [{ userId: id }, { fromUserId: id }, { performedById: id }],
      },
      include: {
        product: { select: { id: true, name: true, code: true } },
        asset: { select: { id: true, code: true, inventoryNumber: true } },
        department: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException('Bu username allaqachon mavjud');
    }

    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });

    if (!department) {
      throw new BadRequestException('Bo\'lim topilmadi');
    }

    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);

    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        email: true,
        position: true,
        departmentId: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Bu username allaqachon mavjud');
      }
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new BadRequestException('Bo\'lim topilmadi');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        email: true,
        position: true,
        departmentId: true,
        updatedAt: true,
      },
    });
  }

  async toggleStatus(id: string) {
    const user = await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        fullName: true,
        username: true,
        isActive: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeAssignments = await this.prisma.assignment.count({
      where: { userId: id },
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

    return { message: 'Xodim muvaffaqiyatli o\'chirildi' };
  }
}