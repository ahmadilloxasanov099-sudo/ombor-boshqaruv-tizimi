import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const department = await prisma.department.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Bosh bo\'lim',
      code: 'MAIN',
      description: 'Asosiy bo\'lim',
    },
  });

  await prisma.user.upsert({
    where: { username: 'ahmadillohasanov099@gmail.com' },
    update: {},
    create: {
      fullName: 'Axmadillo Xasanov',
      username: 'ahmadillohasanov099@gmail.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: UserRole.ADMIN,
      departmentId: department.id,
      position: 'Administrator',
    },
  });

  await prisma.user.upsert({
    where: { username: 'omborchi' },
    update: {},
    create: {
      fullName: 'Omborchi User',
      username: 'omborchi',
      passwordHash: await bcrypt.hash('omborchi123', 10),
      role: UserRole.OMBORCHI,
      departmentId: department.id,
      position: 'Omborchi',
    },
  });

  await prisma.user.upsert({
    where: { username: 'xodim' },
    update: {},
    create: {
      fullName: 'Oddiy Xodim',
      username: 'xodim',
      passwordHash: await bcrypt.hash('xodim123', 10),
      role: UserRole.XODIM,
      departmentId: department.id,
      position: 'Mutaxassis',
    },
  });

  console.log('Seed muvaffaqiyatli bajarildi ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });