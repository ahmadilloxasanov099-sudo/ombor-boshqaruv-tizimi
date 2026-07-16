import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    this.logger.log(
      'Sistemani dastlabki ma’lumotlar bilan tekshirish boshlandi...',
    );

    try {
      // 1. Bo'lim mavjudligini tekshirish yoki yaratish
      let department = await this.prisma.department.findFirst({
        where: { deletedAt: null },
      });

      if (!department) {
        department = await this.prisma.department.create({
          data: {
            name: "Bosh bo'lim",
            description: "Dastlabki boshqaruv bo'limi",
          },
        });
        this.logger.log(`Default bo'lim yaratildi: ${department.name}`);
      }

      // 2. Default foydalanuvchilarni yaratish (Admin, Omborchi, Kadr)
      const seedUsers = [
        {
          username: 'admin',
          fullName: 'Bosh Administrator',
          role: UserRole.ADMIN,
          password: 'admin123',
          position: 'Tizim Administratori',
        },
        {
          username: 'omborchi',
          fullName: 'Bosh Omborchi',
          role: UserRole.OMBORCHI,
          password: 'omborchi123',
          position: 'Ombor Mudiri',
        },
        {
          username: 'kadr',
          fullName: 'Kadrlar Bo‘limi Xodimi',
          role: UserRole.KADR,
          password: 'kadr123',
          position: 'Kadrlar bo‘yicha mutaxassis',
        },
      ];

      for (const u of seedUsers) {
        const existingUser = await this.prisma.user.findFirst({
          where: { username: u.username, deletedAt: null },
        });

        if (!existingUser) {
          const passwordHash = await bcrypt.hash(u.password, 10);
          await this.prisma.user.create({
            data: {
              username: u.username,
              fullName: u.fullName,
              passwordHash,
              role: u.role,
              departmentId: department.id,
              position: u.position,
              phone: '+998900000000',
              isActive: true,
            },
          });
          this.logger.log(
            `Foydalanuvchi yaratildi (${u.role}): username: ${u.username}, password: ${u.password}`,
          );
        }
      }

      this.logger.log(
        'Dastlabki ma’lumotlarni tekshirish muvaffaqiyatli yakunlandi. ✅',
      );
    } catch (error) {
      this.logger.error(
        'Dastlabki ma’lumotlarni yaratishda xatolik yuz berdi:',
        error,
      );
    }
  }
}
