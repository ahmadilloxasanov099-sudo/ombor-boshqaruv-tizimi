import { PrismaClient, UserRole, OrganizationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("Baza tozalanmoqda: faqat Admin, Omborchi va Kadr qoldirilmoqda...");

  // Delete all data in cascade order
  await prisma.deletionRequest.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.operation.deleteMany();
  await prisma.departmentAsset.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.product.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.organization.deleteMany();

  console.log("Eski ma'lumotlar to'liq o'chirildi.");

  // Passwords
  const adminPasswordHash = await bcrypt.hash('axmed123', 10);
  const omborchiPasswordHash = await bcrypt.hash('minstroy', 10);
  const kadrPasswordHash = await bcrypt.hash('kadr123', 10);

  // 1. VAZIRLIK ORGANIZATSIYASI
  const ministry = await prisma.organization.create({
    data: {
      name: "O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi",
      code: "MINISTRY",
      type: OrganizationType.MINISTRY,
      address: "Toshkent shahri, Abay ko'chasi 6",
      phone: "+998 71 200 00 00",
    },
  });

  // 2. ADMIN (Axmadillo Hasanov / axmed / axmed123)
  await prisma.user.create({
    data: {
      fullName: 'Axmadillo Hasanov',
      username: 'axmed',
      passwordHash: adminPasswordHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
    },
  });

  // 3. OMBORCHI (Abdulaziz Urinbadalov / omborchi / minstroy)
  await prisma.user.create({
    data: {
      fullName: 'Abdulaziz Urinbadalov',
      username: 'omborchi',
      passwordHash: omborchiPasswordHash,
      role: UserRole.VAZIRLIK_OMBORCHI,
      position: 'Bosh Omborchi',
      organizationId: ministry.id,
    },
  });

  // 4. KADR (Shahnoza Karimova / kadr / kadr123)
  await prisma.user.create({
    data: {
      fullName: 'Shahnoza Karimova',
      username: 'kadr',
      passwordHash: kadrPasswordHash,
      role: UserRole.KADR,
      position: 'Kadrlar bo\'limi mas\'uli',
      organizationId: ministry.id,
    },
  });

  console.log('====================================================');
  console.log('  SEED MUVAFFAQIYATLI BAJARILDI');
  console.log('  Admin:    axmed / axmed123');
  console.log('  Omborchi: omborchi / minstroy');
  console.log('  Kadr:     kadr / kadr123');
  console.log('====================================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });