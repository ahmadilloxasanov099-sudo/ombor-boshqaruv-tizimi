import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, EmploymentStatus, OperationType } from '@prisma/client';
import { PrismaService } from 'src/prisma';
import { AuditService } from 'src/common/services/audit.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { t } from 'src/common';
import * as xlsx from 'xlsx';
import { EventsGateway } from '../events/events.gateway';
import { ActiveUser } from 'src/common/interfaces';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private eventsGateway: EventsGateway,
  ) {}

  async findAll(query: UserQueryDto, currentUser?: ActiveUser) {
    const { page = 1, limit = 20, search, departmentId, role, employmentStatus, organizationId } = query;
    const skip = (page - 1) * limit;

    let orgFilter: any = {};
    if (organizationId) {
      if (!currentUser || currentUser.organizationId === organizationId || currentUser.role === 'SUPER_ADMIN') {
        orgFilter = {
          OR: [
            { organizationId },
            { organizationId: null },
          ],
        };
      } else {
        orgFilter = { organizationId };
      }
    }

    const where: any = {
      deletedAt: null,
      ...orgFilter,
      ...(role && { role }),
      ...(employmentStatus && { employmentStatus }),
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
          employmentStatus: true,
          isActive: true,
          phone: true,
          internalPhone: true,
          position: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          offboardingStartedAt: true,
          offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
          warehouseApprovedAt: true,
          warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
          offboardingCompletedAt: true,
          offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
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
        employmentStatus: true,
        isActive: true,
        phone: true,
        internalPhone: true,
        position: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        offboardingStartedAt: true,
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
        warehouseApprovedAt: true,
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
        offboardingCompletedAt: true,
        offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(t('errors.USER_NOT_FOUND', {}, 'Xodim topilmadi'));
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
    const creatorUser = await this.prisma.user.findUnique({
      where: { id: createdBy },
      select: { organizationId: true },
    });

    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException(t('errors.ALREADY_EXISTS', {}, 'Bu username allaqachon mavjud'));
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
      data: {
        ...rest,
        passwordHash,
        organizationId: creatorUser?.organizationId || null,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        phone: true,
        internalPhone: true,
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
        throw new BadRequestException(t('errors.ALREADY_EXISTS', {}, 'Bu username allaqachon mavjud'));
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
        internalPhone: true,
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
    const newStatus = !user.isActive;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: newStatus },
        select: {
          id: true,
          fullName: true,
          username: true,
          isActive: true,
        },
      });

      if (!newStatus) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: updatedBy,
          action: AuditAction.UPDATE,
          tableName: 'User',
          recordId: id,
          oldData: { isActive: user.isActive },
          newData: { isActive: updated.isActive },
        },
      });

      return updated;
    });
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

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          userId: deletedBy,
          action: AuditAction.DELETE,
          tableName: 'User',
          recordId: id,
        },
      });

      return { message: "Xodim muvaffaqiyatli o'chirildi" };
    });
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

  async exportCsv(query: UserQueryDto) {
    const { search, departmentId, role } = query;

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { username: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(departmentId && { departmentId }),
      ...(role && { role }),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: {
        department: { select: { name: true } },
        assignments: {
          where: { returnedAt: null },
        },
      },
    });

    const headers = [
      'Ism-sharif',
      'Foydalanuvchi nomi (Username)',
      'Roli',
      'Bo‘lim',
      'Lavozim',
      'Telefon',
      'Holati',
      'Jihozlar soni',
    ];

    const csvRows = [headers.join(',')];

    for (const u of users) {
      const roleText =
        u.role === 'ADMIN'
          ? 'Administrator'
          : u.role === 'OMBORCHI'
            ? 'Omborchi'
            : u.role === 'KADR'
              ? 'Kadr'
              : 'Xodim';
      const statusText = u.isActive ? 'Faol' : 'Bloklangan';
      const row = [
        `"${u.fullName.replace(/"/g, '""')}"`,
        `"${u.username.replace(/"/g, '""')}"`,
        `"${roleText}"`,
        u.department?.name ? `"${u.department.name.replace(/"/g, '""')}"` : '""',
        u.position ? `"${u.position.replace(/"/g, '""')}"` : '',
        u.phone ? `"${u.phone.replace(/"/g, '""')}"` : '',
        `"${statusText}"`,
        u.assignments.length,
      ];
      csvRows.push(row.join(','));
    }

    return '\ufeff' + csvRows.join('\n');
  }

  async importExcel(fileBuffer: Buffer, performedById: string) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException("Excel fayli bo'sh yoki topilmadi");
    }

    let workbook;
    try {
      workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException("Excel faylini o'qib bo'lmadi. Yaroqli .xlsx yoki .xls fayl kiriting.");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException("Excel faylida varaq topilmadi");
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException("Excel varaqlari bo'sh");
    }

    let headerRowIndex = -1;
    let fullNameCol = -1;
    let usernameCol = -1;
    let deptCol = -1;
    let positionCol = -1;
    let phoneCol = -1;
    let internalPhoneCol = -1;
    let passwordCol = -1;
    let roleCol = -1;

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").toLowerCase().trim();

        if ((val.includes("f.i.sh") || val.includes("fio") || val.includes("xodim") || val.includes("nomi") || val.includes("имя") || val.includes("фио") || val.includes("name")) && fullNameCol === -1) {
          fullNameCol = c;
          headerRowIndex = r;
        }
        if ((val.includes("username") || val.includes("login") || val.includes("логин")) && usernameCol === -1) {
          usernameCol = c;
        }
        if ((val.includes("bo'lim") || val.includes("bolim") || val.includes("отдел") || val.includes("dept") || val.includes("department")) && deptCol === -1) {
          deptCol = c;
        }
        if ((val.includes("lavozim") || val.includes("должность") || val.includes("position")) && positionCol === -1) {
          positionCol = c;
        }
        if ((val.includes("telefon") || val.includes("phone") || val.includes("телефон") || val === "tel") && phoneCol === -1 && !val.includes("ichki")) {
          phoneCol = c;
        }
        if ((val.includes("ichki") || val.includes("внутренний") || val.includes("ext") || val.includes("internal")) && internalPhoneCol === -1) {
          internalPhoneCol = c;
        }
        if ((val.includes("parol") || val.includes("password") || val.includes("пароль")) && passwordCol === -1) {
          passwordCol = c;
        }
        if ((val.includes("rol") || val.includes("role") || val.includes("роль")) && roleCol === -1) {
          roleCol = c;
        }
      }

      if (fullNameCol !== -1 && (deptCol !== -1 || phoneCol !== -1 || internalPhoneCol !== -1)) {
        break;
      }
    }

    if (fullNameCol === -1) fullNameCol = 0;
    if (usernameCol === -1) usernameCol = 1;
    if (deptCol === -1) deptCol = 2;
    if (positionCol === -1) positionCol = 3;
    if (phoneCol === -1) phoneCol = 4;
    if (internalPhoneCol === -1) internalPhoneCol = 5;
    if (roleCol === -1) roleCol = 6;
    if (passwordCol === -1) passwordCol = 7;

    const startRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 1;

    const existingDepts = await this.prisma.department.findMany({
      where: { deletedAt: null },
    });
    const deptMap = new Map<string, string>();
    existingDepts.forEach((d) => deptMap.set(d.name.toLowerCase().trim(), d.id));

    const existingUsers = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, username: true, fullName: true, departmentId: true },
    });
    const usernameSet = new Set<string>();
    existingUsers.forEach((u) => usernameSet.add(u.username.toLowerCase().trim()));

    let createdUsers = 0;
    let updatedUsers = 0;
    let createdDepts = 0;
    const defaultPasswordHash = await bcrypt.hash("123456", 10);

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawFullName = String(row[fullNameCol] || "").trim();
      if (!rawFullName || rawFullName.length < 2) continue;

      const rawDeptName = String(row[deptCol] || "").trim() || "Umumiy bo'lim";
      let deptId = deptMap.get(rawDeptName.toLowerCase());

      if (!deptId) {
        const newDept = await this.prisma.department.create({
          data: { name: rawDeptName },
        });
        deptId = newDept.id;
        deptMap.set(rawDeptName.toLowerCase(), deptId);
        createdDepts++;
      }

      let rawUsername = String(row[usernameCol] || "").trim().toLowerCase();
      const rawPosition = String(row[positionCol] || "").trim() || null;
      const rawPhone = String(row[phoneCol] || "").trim() || null;
      const rawInternalPhone = String(row[internalPhoneCol] || "").trim() || null;
      const rawRole = String(row[roleCol] || "").trim().toUpperCase();
      const rawPassword = String(row[passwordCol] || "").trim();

      let userRole: any = "XODIM";
      if (["ADMIN", "OMBORCHI", "KADR", "XODIM"].includes(rawRole)) {
        userRole = rawRole;
      }

      if (!rawUsername) {
        const transliterated = rawFullName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 15);
        const base = transliterated || "xodim";
        rawUsername = base;
        let suffix = 1;
        while (usernameSet.has(rawUsername)) {
          rawUsername = `${base}${suffix}`;
          suffix++;
        }
      }

      let passHash = defaultPasswordHash;
      if (rawPassword && rawPassword.length >= 6) {
        passHash = await bcrypt.hash(rawPassword, 10);
      }

      const existingUser = existingUsers.find(
        (u) => u.username.toLowerCase() === rawUsername
      );

      if (existingUser) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: rawFullName,
            departmentId: deptId,
            ...(rawPosition && { position: rawPosition }),
            ...(rawPhone && { phone: rawPhone }),
            ...(rawInternalPhone && { internalPhone: rawInternalPhone }),
            role: userRole,
          },
        });
        updatedUsers++;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            fullName: rawFullName,
            username: rawUsername,
            passwordHash: passHash,
            role: userRole,
            departmentId: deptId,
            position: rawPosition,
            phone: rawPhone,
            internalPhone: rawInternalPhone,
          },
        });
        usernameSet.add(rawUsername);
        createdUsers++;

        await this.auditService.log({
          userId: performedById,
          action: AuditAction.CREATE,
          tableName: "User",
          recordId: newUser.id,
          newData: newUser,
        });
      }
    }

    return {
      success: true,
      message: `${createdUsers + updatedUsers} ta xodim muvaffaqiyatli yuklandi${
        createdDepts > 0 ? ` (${createdDepts} ta yangi bo'lim yaratildi)` : ""
      }!`,
      totalRows: createdUsers + updatedUsers,
      createdUsers,
      updatedUsers,
      createdDepartments: createdDepts,
    };
  }

  async startOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.ACTIVE) {
      throw new BadRequestException("Xodim allaqachon ishdan bo'shash jarayonida yoki bo'shatilgan");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: EmploymentStatus.OFFBOARDING_PENDING,
        offboardingStartedAt: new Date(),
        offboardingStartedById: performedById,
      },
      include: {
        department: { select: { id: true, name: true } },
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: user.employmentStatus },
      newData: { employmentStatus: EmploymentStatus.OFFBOARDING_PENDING },
    });

    this.eventsGateway.broadcastOffboardingStarted(updatedUser);

    return {
      success: true,
      message: `${updatedUser.fullName} uchun ishdan bo'shash jarayoni boshlandi. Omborchi tasdiqlashi kutilmoqda.`,
      user: updatedUser,
    };
  }

  async getPendingOffboardings() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        employmentStatus: EmploymentStatus.OFFBOARDING_PENDING,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        position: true,
        phone: true,
        employmentStatus: true,
        department: { select: { id: true, name: true } },
        offboardingStartedAt: true,
        offboardingStartedBy: { select: { id: true, fullName: true, username: true } },
        warehouseApprovedAt: true,
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
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
      orderBy: { offboardingStartedAt: 'desc' },
    });

    return users.map((u) => ({
      ...u,
      unreturnedAssetsCount: u.assignments.length,
    }));
  }

  async warehouseApproveOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Xodim ishdan bo'shash jarayonida emas");
    }

    const activeAssignments = await this.prisma.assignment.findMany({
      where: { userId, returnedAt: null },
      include: { asset: true },
    });

    const now = new Date();
    for (const assignment of activeAssignments) {
      await this.prisma.operation.create({
        data: {
          type: OperationType.RETURN_FROM_USER,
          quantity: 1,
          productId: assignment.asset.productId,
          assetId: assignment.assetId,
          userId: userId,
          performedById: performedById,
          note: "Ishdan bo'shatish jarayonida omborchiga topshirildi",
        },
      });

      await this.prisma.assignment.update({
        where: { id: assignment.id },
        data: { returnedAt: now },
      });

      await this.prisma.inventory.updateMany({
        where: { productId: assignment.asset.productId },
        data: { quantity: { increment: 1 } },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        warehouseApprovedAt: now,
        warehouseApprovedById: performedById,
      },
      include: {
        warehouseApprovedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      newData: { warehouseApprovedAt: now, warehouseApprovedById: performedById },
    });

    this.eventsGateway.broadcastWarehouseApproved(updatedUser);

    return {
      success: true,
      message: `${updatedUser.fullName} ning barcha jihozlari omborchi tomonidan qabul qilindi va tasdiqlandi.`,
      user: updatedUser,
    };
  }

  async completeOffboarding(userId: string, performedById: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    if (user.employmentStatus !== EmploymentStatus.OFFBOARDING_PENDING) {
      throw new BadRequestException("Xodim ishdan bo'shash jarayonida emas");
    }

    if (!user.warehouseApprovedAt) {
      throw new BadRequestException("Omborchi barcha jihozlarni qabul qilib tasdiqlamagan!");
    }

    const activeAssignmentsCount = await this.prisma.assignment.count({
      where: { userId, returnedAt: null },
    });

    if (activeAssignmentsCount > 0) {
      throw new BadRequestException(`Xodim zimmasida hali ${activeAssignmentsCount} ta topshirilmagan jihoz bor`);
    }

    const now = new Date();
    const freedUsername = user.username.includes('_offboarded_')
      ? user.username
      : `${user.username}_offboarded_${Date.now()}`;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: EmploymentStatus.OFFBOARDED,
        isActive: false,
        username: freedUsername,
        offboardingCompletedAt: now,
        offboardingCompletedById: performedById,
      },
      include: {
        offboardingCompletedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    await this.auditService.log({
      userId: performedById,
      action: AuditAction.UPDATE,
      tableName: 'User',
      recordId: userId,
      oldData: { employmentStatus: user.employmentStatus, isActive: true },
      newData: { employmentStatus: EmploymentStatus.OFFBOARDED, isActive: false },
    });

    this.eventsGateway.broadcastOffboardingCompleted(updatedUser);

    return {
      success: true,
      message: `${user.fullName} rasman ishdan bo'shatildi! Username keyingi xodimlar uchun bo'shatildi.`,
      user: updatedUser,
    };
  }

  async getOffboardingAkt(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        department: { select: { id: true, name: true } },
        offboardingStartedBy: { select: { id: true, fullName: true, position: true } },
        warehouseApprovedBy: { select: { id: true, fullName: true, position: true } },
        offboardingCompletedBy: { select: { id: true, fullName: true, position: true } },
      },
    });

    if (!user) {
      throw new NotFoundException("Xodim topilmadi");
    }

    const returnedOperations = await this.prisma.operation.findMany({
      where: {
        userId,
        type: OperationType.RETURN_FROM_USER,
      },
      include: {
        product: { select: { name: true, unit: true } },
        asset: { select: { inventoryNumber: true, serialNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const docNumber = `AKT-${new Date().getFullYear()}-${userId.slice(0, 6).toUpperCase()}`;

    return {
      documentNumber: docNumber,
      documentDate: user.offboardingCompletedAt || user.warehouseApprovedAt || new Date(),
      employee: {
        id: user.id,
        fullName: user.fullName,
        position: user.position || "Xodim",
        departmentName: user.department?.name || "Bo'limsiz",
      },
      warehouseManager: {
        fullName: user.warehouseApprovedBy?.fullName || "Bosh Omborchi",
        position: user.warehouseApprovedBy?.position || "Omborchi",
      },
      hrManager: {
        fullName: user.offboardingStartedBy?.fullName || user.offboardingCompletedBy?.fullName || "HR Menejer",
        position: user.offboardingStartedBy?.position || user.offboardingCompletedBy?.position || "Kadrlar Bo'limi",
      },
      returnedAssets: returnedOperations.map((op, idx) => ({
        index: idx + 1,
        productName: op.product?.name || "Noma'lum mahsulot",
        inventoryNumber: op.asset?.inventoryNumber || "-",
        serialNumber: op.asset?.serialNumber || "-",
        returnedAt: op.createdAt,
      })),
    };
  }
}
