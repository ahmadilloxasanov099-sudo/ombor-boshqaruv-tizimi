import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from 'src/prisma';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log({
    userId,
    action,
    tableName,
    recordId,
    oldData,
    newData,
    ipAddress,
    userAgent,
  }: {
    userId: string;
    action: AuditAction;
    tableName: string;
    recordId: string;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName,
        recordId,
        oldData,
        newData,
        ipAddress,
        userAgent,
      },
    });
  }
}
