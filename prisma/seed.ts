import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed boshlandi...');

  const dept = await prisma.department.upsert({
    where: { id: 'dept-bosh' },
    update: {},
    create: {
      id: 'dept-bosh',
      name: "Bosh bo'lim",
      description: "Boshqaruv bo'limi",
    },
  });

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'Super Admin',
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: UserRole.ADMIN,
      departmentId: dept.id,
      position: 'Administrator',
      phone: '+998901234567',
    },
  });

  const omborchi = await prisma.user.upsert({
    where: { username: 'omborchi' },
    update: {},
    create: {
      fullName: 'Bosh Omborchi',
      username: 'omborchi',
      passwordHash: await bcrypt.hash('omborchi123', 10),
      role: UserRole.OMBORCHI,
      departmentId: dept.id,
      position: 'Ombor Mudiri',
      phone: '+998901234568',
    },
  });

  const kadr = await prisma.user.upsert({
    where: { username: 'kadr' },
    update: {},
    create: {
      fullName: 'Kadrlar Bo‘limi Xodimi',
      username: 'kadr',
      passwordHash: await bcrypt.hash('kadr123', 10),
      role: UserRole.KADR,
      departmentId: dept.id,
      position: 'Kadrlar bo‘yicha mutaxassis',
      phone: '+998901234569',
    },
  });

  console.log('✅ Barcha default foydalanuvchilar yaratildi:');
  console.log('  - username: admin (parol: admin123)');
  console.log('  - username: omborchi (parol: omborchi123)');
  console.log('  - username: kadr (parol: kadr123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });