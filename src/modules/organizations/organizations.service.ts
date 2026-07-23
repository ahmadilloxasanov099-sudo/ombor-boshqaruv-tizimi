import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Bunday koddagi (${dto.code}) tashkilot allaqachon mavjud`,
      );
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        address: dto.address,
        phone: dto.phone,
        parentId: dto.parentId,
      },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            products: true,
            assets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        subOrgs: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, type: true },
        },
        _count: {
          select: {
            users: true,
            departments: true,
            products: true,
            assets: true,
            deletionRequests: true,
          },
        },
      },
    });

    if (!org || org.deletedAt) {
      throw new NotFoundException('Tashkilot topilmadi');
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
