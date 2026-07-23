import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { CreateDeletionRequestDto } from './dto/create-deletion-request.dto';
import { ReviewDeletionRequestDto } from './dto/review-deletion-request.dto';
import { EntityType, RequestStatus } from '@prisma/client';

@Injectable()
export class DeletionRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, organizationId: string, dto: CreateDeletionRequestDto) {
    if (!organizationId) {
      throw new BadRequestException("Foydalanuvchi biror tashkilotga biriktirilmagan");
    }

    // Verify entity existence
    let entityName = dto.entityName;
    if (dto.entityType === EntityType.ASSET) {
      const asset = await this.prisma.asset.findUnique({ where: { id: dto.entityId } });
      if (!asset) throw new NotFoundException("O'chirish so'ralayotgan jihoz (Asset) topilmadi");
      entityName = entityName || `Jihoz #${asset.inventoryNumber}`;
    } else if (dto.entityType === EntityType.PRODUCT) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.entityId } });
      if (!product) throw new NotFoundException("O'chirish so'ralayotgan mahsulot (Product) topilmadi");
      entityName = entityName || product.name;
    } else if (dto.entityType === EntityType.USER) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.entityId } });
      if (!user) throw new NotFoundException("O'chirish so'ralayotgan xodim topilmadi");
      entityName = entityName || user.fullName;
    } else if (dto.entityType === EntityType.DEPARTMENT) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.entityId } });
      if (!dept) throw new NotFoundException("O'chirish so'ralayotgan bo'lim topilmadi");
      entityName = entityName || dept.name;
    }

    return this.prisma.deletionRequest.create({
      data: {
        organizationId,
        requestedById: userId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        entityName,
        reason: dto.reason,
        status: RequestStatus.PENDING,
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async findAll(status?: RequestStatus, organizationId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (organizationId) where.organizationId = organizationId;

    return this.prisma.deletionRequest.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyRequests(organizationId: string) {
    return this.findAll(undefined, organizationId);
  }

  async findOne(id: string) {
    const req = await this.prisma.deletionRequest.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true, role: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    if (!req) {
      throw new NotFoundException("O'chirish so'rovi topilmadi");
    }

    return req;
  }

  async approve(id: string, reviewerId: string, dto: ReviewDeletionRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    // Execute soft delete based on entityType
    const now = new Date();
    if (request.entityType === EntityType.ASSET) {
      await this.prisma.asset.updateMany({
        where: { id: request.entityId },
        data: { deletedAt: now },
      });
    } else if (request.entityType === EntityType.PRODUCT) {
      await this.prisma.product.updateMany({
        where: { id: request.entityId },
        data: { deletedAt: now },
      });
    } else if (request.entityType === EntityType.USER) {
      await this.prisma.user.updateMany({
        where: { id: request.entityId },
        data: { deletedAt: now, isActive: false },
      });
    } else if (request.entityType === EntityType.DEPARTMENT) {
      await this.prisma.department.updateMany({
        where: { id: request.entityId },
        data: { deletedAt: now },
      });
    }

    return this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        reviewedById: reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: now,
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async reject(id: string, reviewerId: string, dto: ReviewDeletionRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException("Ushbu so'rov allaqachon ko'rib chiqilgan");
    }

    return this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        reviewedById: reviewerId,
        reviewComment: dto.reviewComment,
        reviewedAt: new Date(),
      },
      include: {
        organization: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, fullName: true, username: true } },
        reviewedBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  }
}
