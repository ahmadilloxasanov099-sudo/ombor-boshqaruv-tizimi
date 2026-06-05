import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { HistoryQueryDto } from './dto/history-query.dto';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: HistoryQueryDto, currentUserId: string, currentUserRole: string) {
    const { page = 1, limit = 20, operationType, userId, departmentId, productId, from, to } = query;
    const skip = (page - 1) * limit;

    // XODIM faqat o'z tarixini ko'ra oladi
    const targetUserId = currentUserRole === 'XODIM' ? currentUserId : userId;

    const where: any = {
      ...(operationType && { type: operationType }),
      ...(departmentId && { departmentId }),
      ...(productId && { productId }),
      ...(targetUserId && {
        OR: [
          { userId: targetUserId },
          { fromUserId: targetUserId },
          { performedById: targetUserId },
        ],
      }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.operation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, code: true, productType: true } },
          asset: { select: { id: true, code: true, inventoryNumber: true } },
          user: { select: { id: true, fullName: true, username: true } },
          fromUser: { select: { id: true, fullName: true, username: true } },
          department: { select: { id: true, name: true, code: true } },
          performedBy: { select: { id: true, fullName: true, username: true } },
        },
      }),
      this.prisma.operation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}