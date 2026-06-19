import { PrismaClient, UserRole, ProductType, UnitType, AssetStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Sana helper — N kun oldin
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  console.log('Seed boshlandi...');

  // ─────────────────────────────────────────────
  // DEPARTMENTS
  // ─────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'BOSH' },
      update: {},
      create: {
        name: "Bosh bo'lim",
        code: 'BOSH',
        description: "Boshqaruv bo'limi",
        createdAt: daysAgo(35),
      },
    }),
    prisma.department.upsert({
      where: { code: 'MOLIYA' },
      update: {},
      create: {
        name: "Moliya bo'limi",
        code: 'MOLIYA',
        description: 'Moliyaviy operatsiyalar',
        createdAt: daysAgo(35),
      },
    }),
    prisma.department.upsert({
      where: { code: 'IT' },
      update: {},
      create: {
        name: "IT bo'lim",
        code: 'IT',
        description: 'Axborot texnologiyalari',
        createdAt: daysAgo(35),
      },
    }),
    prisma.department.upsert({
      where: { code: 'HR' },
      update: {},
      create: {
        name: "Kadrlar bo'limi",
        code: 'HR',
        description: 'Kadrlar boshqaruvi',
        createdAt: daysAgo(35),
      },
    }),
  ]);

  console.log(`✅ ${departments.length} ta bo'lim yaratildi`);

  // ─────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        fullName: 'Super Admin',
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: UserRole.ADMIN,
        departmentId: departments[0].id,
        position: 'Administrator',
        phone: '+998901234567',
        createdAt: daysAgo(35),
      },
    }),
    prisma.user.upsert({
      where: { username: 'omborchi' },
      update: {},
      create: {
        fullName: 'Omborchi Rahimov',
        username: 'omborchi',
        passwordHash: await bcrypt.hash('omborchi123', 10),
        role: UserRole.OMBORCHI,
        departmentId: departments[0].id,
        position: 'Omborchi',
        phone: '+998901234568',
        createdAt: daysAgo(35),
      },
    }),
    prisma.user.upsert({
      where: { username: 'alisher' },
      update: {},
      create: {
        fullName: 'Alisher Karimov',
        username: 'alisher',
        passwordHash: await bcrypt.hash('xodim123', 10),
        role: UserRole.XODIM,
        departmentId: departments[1].id,
        position: 'Bosh mutaxassis',
        phone: '+998901234569',
        createdAt: daysAgo(30),
      },
    }),
    prisma.user.upsert({
      where: { username: 'bobur' },
      update: {},
      create: {
        fullName: 'Bobur Toshmatov',
        username: 'bobur',
        passwordHash: await bcrypt.hash('xodim123', 10),
        role: UserRole.XODIM,
        departmentId: departments[2].id,
        position: 'Dasturchi',
        phone: '+998901234570',
        createdAt: daysAgo(28),
      },
    }),
    prisma.user.upsert({
      where: { username: 'malika' },
      update: {},
      create: {
        fullName: 'Malika Yusupova',
        username: 'malika',
        passwordHash: await bcrypt.hash('xodim123', 10),
        role: UserRole.XODIM,
        departmentId: departments[3].id,
        position: 'Kadrlar inspektori',
        phone: '+998901234571',
        createdAt: daysAgo(25),
      },
    }),
    prisma.user.upsert({
      where: { username: 'jasur' },
      update: {},
      create: {
        fullName: 'Jasur Mirzayev',
        username: 'jasur',
        passwordHash: await bcrypt.hash('xodim123', 10),
        role: UserRole.XODIM,
        departmentId: departments[1].id,
        position: 'Moliya mutaxassisi',
        phone: '+998901234572',
        createdAt: daysAgo(20),
      },
    }),
    prisma.user.upsert({
      where: { username: 'nilufar' },
      update: {},
      create: {
        fullName: 'Nilufar Hasanova',
        username: 'nilufar',
        passwordHash: await bcrypt.hash('xodim123', 10),
        role: UserRole.XODIM,
        departmentId: departments[2].id,
        position: 'Tizim administratori',
        phone: '+998901234573',
        createdAt: daysAgo(15),
      },
    }),
  ]);

  console.log(`✅ ${users.length} ta foydalanuvchi yaratildi`);

  // ─────────────────────────────────────────────
  // PRODUCTS
  // ─────────────────────────────────────────────
  const products = await Promise.all([
    // ASSET lar
    prisma.product.upsert({
      where: { code: 'LNV-E15' },
      update: {},
      create: {
        name: 'Lenovo ThinkPad E15',
        code: 'LNV-E15',
        productType: ProductType.ASSET,
        unit: UnitType.PIECE,
        description: 'Noutbuk kompyuter',
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'SAM-A54' },
      update: {},
      create: {
        name: 'Samsung Galaxy A54',
        code: 'SAM-A54',
        productType: ProductType.ASSET,
        unit: UnitType.PIECE,
        description: 'Smartfon',
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'DEL-LAT' },
      update: {},
      create: {
        name: 'Dell Latitude 5520',
        code: 'DEL-LAT',
        productType: ProductType.ASSET,
        unit: UnitType.PIECE,
        description: 'Noutbuk kompyuter',
        createdAt: daysAgo(32),
      },
    }),
    prisma.product.upsert({
      where: { code: 'HPE-840' },
      update: {},
      create: {
        name: 'HP EliteBook 840',
        code: 'HPE-840',
        productType: ProductType.ASSET,
        unit: UnitType.PIECE,
        description: 'Biznes noutbuk',
        createdAt: daysAgo(32),
      },
    }),
    // CONSUMABLE lar
    prisma.product.upsert({
      where: { code: 'A4-80G' },
      update: {},
      create: {
        name: "A4 Qog'oz 80g",
        code: 'A4-80G',
        productType: ProductType.CONSUMABLE,
        unit: UnitType.PACK,
        description: "A4 formatdagi qog'oz, 500 varaq",
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'SUV-05' },
      update: {},
      create: {
        name: 'Ichimlik suvi 5L',
        code: 'SUV-05',
        productType: ProductType.CONSUMABLE,
        unit: UnitType.PIECE,
        description: '5 litrlik ichimlik suvi',
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'RUC-001' },
      update: {},
      create: {
        name: 'Ruchka (qora)',
        code: 'RUC-001',
        productType: ProductType.CONSUMABLE,
        unit: UnitType.PIECE,
        description: 'Yozuv uchun qora ruchka',
        createdAt: daysAgo(33),
      },
    }),
    // SHARED lar
    prisma.product.upsert({
      where: { code: 'HP-M404' },
      update: {},
      create: {
        name: 'HP LaserJet Pro M404',
        code: 'HP-M404',
        productType: ProductType.SHARED,
        unit: UnitType.PIECE,
        description: 'Lazer printer',
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'CAN-DR' },
      update: {},
      create: {
        name: 'Canon DR-C240',
        code: 'CAN-DR',
        productType: ProductType.SHARED,
        unit: UnitType.PIECE,
        description: 'Hujjat skaneri',
        createdAt: daysAgo(33),
      },
    }),
    prisma.product.upsert({
      where: { code: 'EPS-PRJ' },
      update: {},
      create: {
        name: 'Epson EB-X49 Proyektor',
        code: 'EPS-PRJ',
        productType: ProductType.SHARED,
        unit: UnitType.PIECE,
        description: 'Yig\'ilish xonasi proyektori',
        createdAt: daysAgo(33),
      },
    }),
  ]);

  console.log(`✅ ${products.length} ta mahsulot yaratildi`);

  // ─────────────────────────────────────────────
  // INVENTORY
  // ─────────────────────────────────────────────
  for (const product of products) {
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        quantity: 0,
        minLevel: 0,
        createdAt: daysAgo(33),
      },
    });
  }

  const omborchi = users[1];

  const stockData = [
    { product: products[0], quantity: 15, unitPrice: 9000000, days: 32 },
    { product: products[1], quantity: 10, unitPrice: 4500000, days: 32 },
    { product: products[2], quantity: 8,  unitPrice: 11000000, days: 30 },
    { product: products[3], quantity: 6,  unitPrice: 8500000, days: 28 },
    { product: products[4], quantity: 100, unitPrice: 45000, days: 32 },
    { product: products[5], quantity: 50,  unitPrice: 15000, days: 30 },
    { product: products[6], quantity: 200, unitPrice: 5000,  days: 25 },
    { product: products[7], quantity: 5,  unitPrice: 3500000, days: 32 },
    { product: products[8], quantity: 3,  unitPrice: 2800000, days: 32 },
    { product: products[9], quantity: 2,  unitPrice: 5500000, days: 29 },
  ];

  for (const item of stockData) {
    await prisma.inventory.update({
      where: { productId: item.product.id },
      data: {
        quantity: { increment: item.quantity },
        unitPrice: item.unitPrice,
        totalValue: item.quantity * item.unitPrice,
        minLevel: Math.floor(item.quantity * 0.2),
      },
    });

    await prisma.operation.create({
      data: {
        type: 'STOCK_IN',
        quantity: item.quantity,
        productId: item.product.id,
        performedById: omborchi.id,
        documentNumber: 'AKT-2024-001',
        note: "Boshlang'ich kirim",
        createdAt: daysAgo(item.days),
      },
    });
  }

  console.log('✅ Inventory yangilandi');

  // ─────────────────────────────────────────────
  // ASSETS — xodimlarga jihoz berish
  // ─────────────────────────────────────────────
  const alisher = users[2];
  const bobur = users[3];
  const malika = users[4];
  const jasur = users[5];
  const nilufar = users[6];

  const assetData = [
    {
      product: products[0],
      inventoryNumber: 'INV-2024-001',
      serialNumber: 'PF2X0001',
      purchasePrice: 9000000,
      user: alisher,
      days: 28,
      docNum: 'AKT-2024-002',
    },
    {
      product: products[1],
      inventoryNumber: 'INV-2024-002',
      serialNumber: 'SAM0001',
      purchasePrice: 4500000,
      user: bobur,
      days: 26,
      docNum: 'AKT-2024-003',
    },
    {
      product: products[2],
      inventoryNumber: 'INV-2024-003',
      serialNumber: 'DEL0001',
      purchasePrice: 11000000,
      user: nilufar,
      days: 20,
      docNum: 'AKT-2024-004',
    },
    {
      product: products[3],
      inventoryNumber: 'INV-2024-004',
      serialNumber: 'HPE0001',
      purchasePrice: 8500000,
      user: jasur,
      days: 18,
      docNum: 'AKT-2024-005',
    },
    {
      product: products[0],
      inventoryNumber: 'INV-2024-005',
      serialNumber: 'PF2X0002',
      purchasePrice: 9000000,
      user: malika,
      days: 15,
      docNum: 'AKT-2024-006',
    },
  ];

  for (const item of assetData) {
    const asset = await prisma.asset.upsert({
      where: { inventoryNumber: item.inventoryNumber },
      update: {},
      create: {
        productId: item.product.id,
        inventoryNumber: item.inventoryNumber,
        code: item.inventoryNumber,
        serialNumber: item.serialNumber,
        status: AssetStatus.ACTIVE,
        purchasePrice: item.purchasePrice,
        createdAt: daysAgo(item.days),
      },
    });

    await prisma.assignment.upsert({
      where: { userId_assetId: { userId: item.user.id, assetId: asset.id } },
      update: {},
      create: {
        userId: item.user.id,
        assetId: asset.id,
        createdAt: daysAgo(item.days),
      },
    });

    await prisma.inventory.update({
      where: { productId: item.product.id },
      data: { quantity: { decrement: 1 } },
    });

    await prisma.operation.create({
      data: {
        type: 'GIVE_TO_USER',
        quantity: 1,
        userId: item.user.id,
        assetId: asset.id,
        productId: item.product.id,
        performedById: omborchi.id,
        documentNumber: item.docNum,
        note: `${item.user.fullName}ga jihoz berildi`,
        createdAt: daysAgo(item.days),
      },
    });
  }

  console.log('✅ Assetlar biriktirildi');

  // ─────────────────────────────────────────────
  // DEPARTMENT ASSETS
  // ─────────────────────────────────────────────
  const deptAssetData = [
    {
      dept: departments[1],
      product: products[4],
      quantity: 20,
      type: 'GIVE_TO_DEPT' as const,
      days: 27,
      note: "Moliya bo'limiga qog'oz berildi",
    },
    {
      dept: departments[2],
      product: products[4],
      quantity: 30,
      type: 'GIVE_TO_DEPT' as const,
      days: 22,
      note: "IT bo'limiga qog'oz berildi",
    },
    {
      dept: departments[3],
      product: products[5],
      quantity: 20,
      type: 'GIVE_TO_DEPT' as const,
      days: 20,
      note: "HR bo'limiga suv berildi",
    },
    {
      dept: departments[1],
      product: products[6],
      quantity: 50,
      type: 'GIVE_TO_DEPT' as const,
      days: 18,
      note: "Moliya bo'limiga ruchka berildi",
    },
    {
      dept: departments[2],
      product: products[7],
      quantity: 1,
      type: 'ASSIGN_TO_DEPT' as const,
      days: 25,
      note: "IT bo'limiga printer berildi",
    },
    {
      dept: departments[1],
      product: products[8],
      quantity: 1,
      type: 'ASSIGN_TO_DEPT' as const,
      days: 24,
      note: "Moliya bo'limiga skaner berildi",
    },
    {
      dept: departments[0],
      product: products[9],
      quantity: 1,
      type: 'ASSIGN_TO_DEPT' as const,
      days: 23,
      note: "Bosh bo'limga proyektor berildi",
    },
  ];

  for (const item of deptAssetData) {
    await prisma.departmentAsset.upsert({
      where: {
        departmentId_productId: {
          departmentId: item.dept.id,
          productId: item.product.id,
        },
      },
      update: { quantity: { increment: item.quantity } },
      create: {
        departmentId: item.dept.id,
        productId: item.product.id,
        quantity: item.quantity,
        createdAt: daysAgo(item.days),
      },
    });

    await prisma.inventory.update({
      where: { productId: item.product.id },
      data: { quantity: { decrement: item.quantity } },
    });

    await prisma.operation.create({
      data: {
        type: item.type,
        quantity: item.quantity,
        departmentId: item.dept.id,
        productId: item.product.id,
        performedById: omborchi.id,
        note: item.note,
        createdAt: daysAgo(item.days),
      },
    });
  }

  console.log("✅ Bo'lim assetlari biriktirildi");

  // ─────────────────────────────────────────────
  // QO'SHIMCHA OPERATSIYALAR — tarix boy bo'lsin
  // ─────────────────────────────────────────────

  // Qaytarish operatsiyasi — 10 kun oldin
  await prisma.operation.create({
    data: {
      type: 'RETURN_FROM_USER',
      quantity: 1,
      userId: alisher.id,
      productId: products[0].id,
      performedById: omborchi.id,
      note: 'Vaqtinchalik qaytarish',
      createdAt: daysAgo(10),
    },
  });

  // Transfer operatsiyasi — 7 kun oldin
  await prisma.operation.create({
    data: {
      type: 'TRANSFER_USER',
      quantity: 1,
      userId: bobur.id,
      fromUserId: alisher.id,
      productId: products[1].id,
      performedById: omborchi.id,
      note: "Bobur Toshmatovga o'tkazildi",
      createdAt: daysAgo(7),
    },
  });

  // Yangi kirim — 5 kun oldin
  await prisma.operation.create({
    data: {
      type: 'STOCK_IN',
      quantity: 5,
      productId: products[0].id,
      performedById: omborchi.id,
      documentNumber: 'AKT-2024-010',
      note: "Qo'shimcha kirim",
      createdAt: daysAgo(5),
    },
  });

  await prisma.inventory.update({
    where: { productId: products[0].id },
    data: { quantity: { increment: 5 } },
  });

  // Yangi kirim — 3 kun oldin
  await prisma.operation.create({
    data: {
      type: 'STOCK_IN',
      quantity: 10,
      productId: products[4].id,
      performedById: omborchi.id,
      documentNumber: 'AKT-2024-011',
      note: "Qog'oz qo'shimcha kirim",
      createdAt: daysAgo(3),
    },
  });

  await prisma.inventory.update({
    where: { productId: products[4].id },
    data: { quantity: { increment: 10 } },
  });

  console.log('✅ Qo\'shimcha operatsiyalar yaratildi');
  console.log('');
  console.log('🎉 Seed muvaffaqiyatli bajarildi!');
  console.log('');
  console.log("Login ma'lumotlari:");
  console.log('  Admin    → username: admin,    parol: admin123');
  console.log('  Omborchi → username: omborchi, parol: omborchi123');
  console.log('  Xodim 1  → username: alisher,  parol: xodim123');
  console.log('  Xodim 2  → username: bobur,    parol: xodim123');
  console.log('  Xodim 3  → username: malika,   parol: xodim123');
  console.log('  Xodim 4  → username: jasur,    parol: xodim123');
  console.log('  Xodim 5  → username: nilufar,  parol: xodim123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });