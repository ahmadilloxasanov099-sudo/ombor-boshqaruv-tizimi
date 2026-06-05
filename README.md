================================================================
     OMBOR BOSHQARUV TIZIMI — TO'LIQ LOYHA TAVSIFI
     NestJS + PostgreSQL + Prisma
================================================================
Tayyorlangan: 2026
Maqsad: Davlat idorasi uchun jihoz va material boshqaruvi
================================================================


================================================================
  QISM 1 — TIZIM HAQIDA UMUMIY MA'LUMOT
================================================================

Tizim 3 daraja foydalanuvchi bilan ishlaydi:

  ADMIN      — Hamma narsani ko'radi va boshqaradi
  OMBORCHI   — Operatsiyalarni bajaradi, hisobotlarni ko'radi
  XODIM      — Faqat o'zidagi jihozlarni ko'radi

Mahsulotning 3 turi bor, har turi boshqacha ishlaydi:

  ASSET      — Xodimga beriladi, qaytarib olinadi
               Misol: noutbuk, telefon, zoom kamera, flesh-disk

  CONSUMABLE — Bo'limga beriladi, sarflanib ketadi, qaytmaydi
               Misol: A4 qog'oz, ichimlik suvi, ruchka, papka

  SHARED     — Bo'limga biriktiriladi, qaytarib olinishi mumkin
               Misol: printer, skaner, MFU, proyektor

Tashkilot tuzilishi:

  Barcha bo'limlar teng darajada — ierarxiya yo'q.
  Har bir xodim bitta bo'limga biriktiriladi.
  1 ta markaziy ombor — barcha bo'limlar shu ombordan oladi.


================================================================
  QISM 2 — BARCHA FUNKSIONALIKLAR (11 TA)
================================================================

------------------------------------------------------------
  F-01. BO'LIMLAR BOSHQARUVI
------------------------------------------------------------
Nima qiladi:
  Bo'limlarni (Department) yaratadi va boshqaradi.
  Har bir bo'limning nomi va kodi bo'ladi.

Imkoniyatlar:
  - Yangi bo'lim qo'shish
  - Tahrirlash (nom, kod, tavsif)
  - O'chirish (faqat bo'sh bo'lsa — xodim va jihozi yo'q)
  - Barcha bo'limlar ro'yxatini olish
  - Bo'lim statistikasini ko'rish (xodim soni, jihoz soni)

Kim foydalanadi: faqat ADMIN


------------------------------------------------------------
  F-02. FOYDALANUVCHILAR BOSHQARUVI
------------------------------------------------------------
Nima qiladi:
  Xodimlarni tizimga qo'shadi, tahrirlaydi, bloklaydi.
  Xodim qaysi bo'limda ekanligi belgilanadi.
  Rol tayinlanadi.

Imkoniyatlar:
  - Xodim qo'shish (bo'lim va rol bilan)
  - Tahrirlash (ism, bo'lim, rol, telefon, lavozim)
  - Faollashtirish / Bloklash
  - O'chirish (soft delete — tarix saqlanadi)
  - Xodim ro'yxatini olish (qidiruv, pagination)
  - Xodimda hozir nima borligini ko'rish
  - Xodimning harakatlar tarixini ko'rish

Kim foydalanadi: faqat ADMIN


------------------------------------------------------------
  F-03. MAHSULOTLAR KATALOGI
------------------------------------------------------------
Nima qiladi:
  Barcha mahsulot va materiallar katalogini yuritadi.
  Har bir mahsulotning turi (ASSET/CONSUMABLE/SHARED)
  belgilanadi va shu turga qarab operatsiyalar ruxsat etiladi.

Imkoniyatlar:
  - Mahsulot qo'shish (nom, kod, tur, o'lchov birligi)
  - Tahrirlash
  - O'chirish (soft delete — tarix saqlanadi)
  - Ro'yxat olish (qidiruv, tur bo'yicha filtri, pagination)
  - Bitta mahsulot tafsilotini ko'rish
  - Mahsulot harakatlari tarixini ko'rish

Kim foydalanadi: ADMIN to'liq, OMBORCHI ko'rish, XODIM ko'rish


------------------------------------------------------------
  F-04. MARKAZIY OMBOR BOSHQARUVI
------------------------------------------------------------
Nima qiladi:
  Yagona markaziy omborni yuritadi.
  Mahsulot kirim qilinadi, chiqim amalga oshiriladi.
  Minimal daraja belgilanadi — shu darajadan tushsa ogohlantirish.

Imkoniyatlar:
  - Omborga kirim qo'shish (STOCK_IN)
  - Joriy ombor holatini ko'rish
  - Mahsulot minimal darajasini belgilash
  - Kam qolgan mahsulotlar ro'yxatini olish
  - Ombor harakatlari tarixini ko'rish

Kim foydalanadi: ADMIN to'liq, OMBORCHI to'liq, XODIM ko'rish


------------------------------------------------------------
  F-05. JIHOZ BERISH VA QAYTARISH (ASSET)
------------------------------------------------------------
Nima qiladi:
  Noutbuk, telefon kabi jihozlarni xodimga rasman beradi.
  Har bir jihoz inventar raqami va seriya raqami bilan kuzatiladi.
  Xodim mas'ul hisoblanadi. Qaytarish va o'tkazish mumkin.

Operatsiyalar:
  GIVE_TO_USER     — Ombordan xodimga jihoz berish
  RETURN_FROM_USER — Xodimdan omborga qaytarish
  TRANSFER_USER    — Bir xodimdan ikkinchisiga o'tkazish

Har bir operatsiyada bir vaqtda:
  → Ombor miqdori yangilanadi
  → Xodim jihozi yangilanadi (Assignment)
  → Tarixga yoziladi
  (Hammasi bitta transaksiyada — xato bo'lsa hamma narsa bekor)

Kim foydalanadi: ADMIN, OMBORCHI


------------------------------------------------------------
  F-06. MATERIAL SARFLASH (CONSUMABLE)
------------------------------------------------------------
Nima qiladi:
  A4 qog'oz, suv, ruchka kabi materiallarni bo'limga beradi.
  Bo'lim sarflab yuboradi — qaytarish yo'q.
  Bo'lim stokida qoldig'i kuzatiladi (DepartmentAsset).

Operatsiyalar:
  GIVE_TO_DEPT — Ombordan bo'limga material berish

Har bir operatsiyada:
  → Ombor miqdori kamayadi
  → Bo'lim stoki ko'payadi
  → Tarixga yoziladi
  (Hammasi bitta transaksiyada)

Kim foydalanadi: ADMIN, OMBORCHI


------------------------------------------------------------
  F-07. BO'LIM UMUMIY JIHOZI (SHARED)
------------------------------------------------------------
Nima qiladi:
  Printer, skaner, MFU kabi jihozlarni bo'limga birikтиради.
  Bo'lim xodimlari almashib ishlatadi.
  Qaytarish mumkin (eskirsa, yangi kelsa).

Operatsiyalar:
  ASSIGN_TO_DEPT   — Ombordan bo'limga jihoz berish
  RETURN_FROM_DEPT — Bo'limdan omborga qaytarish

Har bir operatsiyada:
  → Ombor miqdori yangilanadi
  → Bo'lim stoki yangilanadi (DepartmentAsset)
  → Tarixga yoziladi
  (Hammasi bitta transaksiyada)

Kim foydalanadi: ADMIN, OMBORCHI


------------------------------------------------------------
  F-08. TO'LIQ AUDIT TARIXI
------------------------------------------------------------
Nima qiladi:
  Tizimda bajarilgan barcha harakatlarni saqlaydi.
  Kim, nima, qachon, kim bajardi — hammasi yoziladi.

Imkoniyatlar:
  - Barcha tarixni ko'rish (pagination)
  - Xodim bo'yicha filtri
  - Mahsulot bo'yicha filtri
  - Operatsiya turi bo'yicha filtri
  - Sana oralig'i bo'yicha filtri
  - Bo'lim bo'yicha filtri

Kim foydalanadi: ADMIN va OMBORCHI barchasini, XODIM faqat o'zinikini


------------------------------------------------------------
  F-09. STATISTIKA VA HISOBOTLAR
------------------------------------------------------------
Nima qiladi:
  Rahbariyat va omborchi uchun umumiy ko'rsatkichlar.
  Qaysi bo'limda nima bor, kim ko'p oldi, nima kam qoldi.

Imkoniyatlar:
  - Umumiy overview (mahsulot soni, xodim soni, ombor holati)
  - Bo'lim bo'yicha jihozlar taqqoslash
  - Eng ko'p sarflanadigan mahsulotlar
  - Kam qolgan mahsulotlar ro'yxati
  - Oy bo'yicha sarflash dinamikasi
  - Xodim bo'yicha jihoz yuklamasi

Kim foydalanadi: ADMIN, OMBORCHI


------------------------------------------------------------
  F-10. INVENTARIZATSIYA
------------------------------------------------------------
Nima qiladi:
  Xodim tashkilotni tark etganda yoki bo'lim o'zgarganda
  uning barcha jihozlarini topshirish jarayoni.

Imkoniyatlar:
  - Xodimda nima bor — to'liq ro'yxat
  - Ommaviy qaytarish (bitta so'rovda hammasi)
  - Boshqa xodimga ommaviy o'tkazish
  - Inventarizatsiya sanasi va bajaruvchi saqlanadi

Kim foydalanadi: ADMIN, OMBORCHI


------------------------------------------------------------
  F-11. OGOHLANTIRISHLAR (LOW STOCK ALERT)
------------------------------------------------------------
Nima qiladi:
  Ombordagi mahsulot minimal darajadan tushganda
  tizim ogohlantiradi.

Imkoniyatlar:
  - Kam qolgan mahsulotlar ro'yxati (real-time)
  - Tanqislik miqdorini ko'rish (minLevel - quantity)

Kim foydalanadi: ADMIN, OMBORCHI


================================================================
  QISM 3 — BARCHA API ENDPOINTLAR
================================================================

Jami: 42 ta endpoint
Base URL: /api/v1

Rol belgilari:
  [A]  = faqat ADMIN
  [AO] = ADMIN + OMBORCHI
  [ALL]= Barcha (ADMIN + OMBORCHI + XODIM)
  [*]  = Roli bo'yicha cheklangan (quyida izoh)

------------------------------------------------------------
  AUTH — 5 ta endpoint
------------------------------------------------------------

  POST   /auth/login               [ALL]  Tizimga kirish
  POST   /auth/refresh             [ALL]  Token yangilash
  POST   /auth/logout              [ALL]  Tizimdan chiqish
  GET    /auth/me                  [ALL]  O'z profilini ko'rish
  PUT    /auth/change-password     [ALL]  Parolni o'zgartirish


------------------------------------------------------------
  DEPARTMENTS — 5 ta endpoint
------------------------------------------------------------

  GET    /departments              [A]    Barcha bo'limlar ro'yxati
  GET    /departments/:id          [A]    Bitta bo'lim
  GET    /departments/:id/stats    [AO]   Bo'lim statistikasi
  POST   /departments              [A]    Yangi bo'lim qo'shish
  PUT    /departments/:id          [A]    Tahrirlash
  DELETE /departments/:id          [A]    O'chirish (bo'sh bo'lsa)

  (Jami: 6 ta endpoint)


------------------------------------------------------------
  USERS — 7 ta endpoint
------------------------------------------------------------

  GET    /users                    [A]    Ro'yxat (search, page, limit, deptId)
  GET    /users/:id                [A]    Bitta xodim ma'lumoti
  GET    /users/:id/assignments    [AO]   Xodimda hozir nima bor
  GET    /users/:id/history        [*]    Xodim tarixi (XODIM faqat o'ziniki)
  POST   /users                    [A]    Yangi xodim qo'shish
  PUT    /users/:id                [A]    Tahrirlash
  PATCH  /users/:id/status         [A]    Faollashtirish yoki bloklash


------------------------------------------------------------
  PRODUCTS — 7 ta endpoint
------------------------------------------------------------

  GET    /products                 [ALL]  Ro'yxat (search, type, page, limit)
  GET    /products/:id             [ALL]  Bitta mahsulot
  GET    /products/:id/history     [AO]   Mahsulot harakatlari tarixi
  GET    /products/low-stock       [AO]   Kam qolgan mahsulotlar
  POST   /products                 [A]    Yangi mahsulot qo'shish
  PUT    /products/:id             [A]    Tahrirlash
  DELETE /products/:id             [A]    O'chirish (soft delete)


------------------------------------------------------------
  INVENTORY — 5 ta endpoint
------------------------------------------------------------

  GET    /inventory                [AO]   Barcha ombor holati
  GET    /inventory/:productId     [AO]   Bitta mahsulot miqdori
  POST   /inventory/stock-in       [AO]   Omborga kirim qo'shish
  PATCH  /inventory/min-level      [AO]   Minimal darajani belgilash
  GET    /inventory/low-stock      [AO]   Kam qolgan mahsulotlar


------------------------------------------------------------
  OPERATIONS — 6 ta endpoint
------------------------------------------------------------

  POST   /operations/give-to-user       [AO]  Xodimga jihoz berish
         Body: { userId, assetId, note?, documentNumber? }

  POST   /operations/return-from-user   [AO]  Xodimdan jihoz qaytarish
         Body: { userId, assetId, note?, documentNumber? }

  POST   /operations/transfer-user      [AO]  Xodimdan xodimga o'tkazish
         Body: { fromUserId, toUserId, assetId, note?, documentNumber? }

  POST   /operations/give-to-dept       [AO]  Bo'limga material berish
         Body: { departmentId, productId, quantity, note?, documentNumber? }

  POST   /operations/assign-to-dept     [AO]  Bo'limga umumiy jihoz berish
         Body: { departmentId, productId, quantity, note?, documentNumber? }

  POST   /operations/return-from-dept   [AO]  Bo'limdan jihoz qaytarish
         Body: { departmentId, productId, quantity, note?, documentNumber? }


------------------------------------------------------------
  HISTORY — 1 ta endpoint (filter parametrlar bilan)
------------------------------------------------------------

  GET    /history                  [*]   Tarix ro'yxati

  Query parametrlar:
    ?operationType=GIVE_TO_USER    Operatsiya turi bo'yicha
    ?userId=uuid                   Xodim bo'yicha
    ?departmentId=uuid             Bo'lim bo'yicha
    ?productId=uuid                Mahsulot bo'yicha
    ?from=2025-01-01               Boshlanish sanasi
    ?to=2025-12-31                 Tugash sanasi
    ?page=1&limit=20               Pagination

  Izoh: XODIM faqat o'z userId bo'yicha so'ray oladi.
        Boshqa userId kiritsа — 403 Forbidden qaytadi.


------------------------------------------------------------
  STATS — 5 ta endpoint
------------------------------------------------------------

  GET    /stats/overview           [AO]  Umumiy ko'rsatkichlar
  GET    /stats/by-department      [AO]  Bo'lim bo'yicha jihozlar
  GET    /stats/by-product         [AO]  Mahsulot bo'yicha sarflash
  GET    /stats/low-stock          [AO]  Kam qolgan mahsulotlar
  GET    /stats/monthly            [AO]  Oy bo'yicha sarflash dinamikasi


------------------------------------------------------------
  JAMI ENDPOINT SONI
------------------------------------------------------------

  Auth          →   5 ta
  Departments   →   6 ta
  Users         →   7 ta
  Products      →   7 ta
  Inventory     →   5 ta
  Operations    →   6 ta
  History       →   1 ta
  Stats         →   5 ta
  --------------------------------
  JAMI          →  42 ta endpoint


================================================================
  QISM 4 — NESTJS MODULLAR TUZILISHI
================================================================

Jami: 10 ta modul + umumiy qismlar (guards, pipes, interceptors)

------------------------------------------------------------
  MODUL 1: AppModule (asosiy modul)
------------------------------------------------------------
Fayl: src/app.module.ts

Vazifasi:
  Barcha modullarni birlashtiradi.
  Global konfiguratsiya, database ulanishi, global guard.

Ichida:
  - ConfigModule (global, .env o'qish)
  - PrismaModule (global, database ulanish)
  - Barcha feature modullar import qilinadi


------------------------------------------------------------
  MODUL 2: PrismaModule
------------------------------------------------------------
Fayl: src/prisma/prisma.module.ts
      src/prisma/prisma.service.ts

Vazifasi:
  Prisma Client ni global singleton sifatida beradi.
  Barcha boshqa modullar shu servisdan foydalanadi.
  onModuleInit da database ga ulanadi.
  onModuleDestroy da ulanishni yopadi.

Export qiladi: PrismaService


------------------------------------------------------------
  MODUL 3: AuthModule
------------------------------------------------------------
Fayl: src/auth/auth.module.ts
      src/auth/auth.controller.ts
      src/auth/auth.service.ts
      src/auth/strategies/jwt.strategy.ts
      src/auth/strategies/refresh.strategy.ts
      src/auth/guards/jwt-auth.guard.ts
      src/auth/guards/roles.guard.ts
      src/auth/decorators/roles.decorator.ts
      src/auth/decorators/current-user.decorator.ts
      src/auth/dto/login.dto.ts
      src/auth/dto/change-password.dto.ts

Vazifasi:
  Login, logout, token yangilash, parol o'zgartirish.
  JWT access token (15 daqiqa) va refresh token (30 kun).
  JwtStrategy — har so'rovda tokenni tekshiradi.
  RolesGuard — rol asosida kirish nazorati.

Endpointlar:
  POST /auth/login
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/me
  PUT  /auth/change-password

Global export qiladi: JwtAuthGuard, RolesGuard


------------------------------------------------------------
  MODUL 4: DepartmentsModule
------------------------------------------------------------
Fayl: src/departments/departments.module.ts
      src/departments/departments.controller.ts
      src/departments/departments.service.ts
      src/departments/dto/create-department.dto.ts
      src/departments/dto/update-department.dto.ts

Vazifasi:
  Bo'limlarni boshqaradi.
  Bo'lim statistikasini hisoblaydi
  (xodim soni, jihoz soni, material miqdori).

Endpointlar:
  GET    /departments
  GET    /departments/:id
  GET    /departments/:id/stats
  POST   /departments
  PUT    /departments/:id
  DELETE /departments/:id


------------------------------------------------------------
  MODUL 5: UsersModule
------------------------------------------------------------
Fayl: src/users/users.module.ts
      src/users/users.controller.ts
      src/users/users.service.ts
      src/users/dto/create-user.dto.ts
      src/users/dto/update-user.dto.ts
      src/users/dto/user-query.dto.ts

Vazifasi:
  Xodimlarni boshqaradi.
  Qidiruv (ILIKE orqali).
  Xodim jihozlari va tarixini beradi.
  Soft delete (deletedAt).

Endpointlar:
  GET    /users
  GET    /users/:id
  GET    /users/:id/assignments
  GET    /users/:id/history
  POST   /users
  PUT    /users/:id
  PATCH  /users/:id/status


------------------------------------------------------------
  MODUL 6: ProductsModule
------------------------------------------------------------
Fayl: src/products/products.module.ts
      src/products/products.controller.ts
      src/products/products.service.ts
      src/products/dto/create-product.dto.ts
      src/products/dto/update-product.dto.ts
      src/products/dto/product-query.dto.ts

Vazifasi:
  Mahsulotlar katalogini yuritadi.
  productType bo'yicha filterlash.
  Soft delete (deletedAt).
  Mahsulot tarixini beradi.

Endpointlar:
  GET    /products
  GET    /products/:id
  GET    /products/:id/history
  GET    /products/low-stock
  POST   /products
  PUT    /products/:id
  DELETE /products/:id


------------------------------------------------------------
  MODUL 7: InventoryModule
------------------------------------------------------------
Fayl: src/inventory/inventory.module.ts
      src/inventory/inventory.controller.ts
      src/inventory/inventory.service.ts
      src/inventory/dto/stock-in.dto.ts
      src/inventory/dto/set-min-level.dto.ts

Vazifasi:
  Markaziy ombor holatini ko'rsatadi va kirim qo'shadi.
  Minimal daraja sozlaydi.
  Kam qolgan mahsulotlarni topadi.
  OperationsModule dan chaqiriladi (inventory yangilash).

Endpointlar:
  GET    /inventory
  GET    /inventory/:productId
  POST   /inventory/stock-in
  PATCH  /inventory/min-level
  GET    /inventory/low-stock


------------------------------------------------------------
  MODUL 8: OperationsModule
------------------------------------------------------------
Fayl: src/operations/operations.module.ts
      src/operations/operations.controller.ts
      src/operations/operations.service.ts
      src/operations/dto/give-to-user.dto.ts
      src/operations/dto/return-from-user.dto.ts
      src/operations/dto/transfer-user.dto.ts
      src/operations/dto/give-to-dept.dto.ts
      src/operations/dto/assign-to-dept.dto.ts
      src/operations/dto/return-from-dept.dto.ts

Vazifasi:
  BARCHA operatsiyalarni bajaradi.
  Har bir operatsiya Prisma $transaction ichida ishlaydi.
  productType tekshiradi — noto'g'ri operatsiyaga 400 qaytadi.
  Ombor miqdori yetarli emasligida 400 qaytadi.
  Tarixga yozadi (har doim).

Endpointlar:
  POST   /operations/give-to-user
  POST   /operations/return-from-user
  POST   /operations/transfer-user
  POST   /operations/give-to-dept
  POST   /operations/assign-to-dept
  POST   /operations/return-from-dept

Bu modul eng muhim modul — barcha tranzaksiyalar shu yerda.


------------------------------------------------------------
  MODUL 9: HistoryModule
------------------------------------------------------------
Fayl: src/history/history.module.ts
      src/history/history.controller.ts
      src/history/history.service.ts
      src/history/dto/history-query.dto.ts

Vazifasi:
  Tarixni filtri bilan beradi.
  XODIM faqat o'z tarixini ko'ra oladi (guard tekshiradi).
  Pagination (page + limit).
  Sana oralig'i, operatsiya turi, xodim, mahsulot filtrlari.

Endpointlar:
  GET    /history


------------------------------------------------------------
  MODUL 10: StatsModule
------------------------------------------------------------
Fayl: src/stats/stats.module.ts
      src/stats/stats.controller.ts
      src/stats/stats.service.ts

Vazifasi:
  Hisobot va statistika so'rovlarini bajaradi.
  Umumiy overview, bo'lim bo'yicha, mahsulot bo'yicha,
  kam qolganlar, oylik dinamika.

Endpointlar:
  GET    /stats/overview
  GET    /stats/by-department
  GET    /stats/by-product
  GET    /stats/low-stock
  GET    /stats/monthly


------------------------------------------------------------
  UMUMIY (SHARED) QISMLAR
------------------------------------------------------------

src/common/guards/
  jwt-auth.guard.ts     — Har so'rovda JWT tekshiradi
  roles.guard.ts        — Rol asosida kirish nazorati

src/common/decorators/
  roles.decorator.ts        — @Roles('ADMIN', 'OMBORCHI')
  current-user.decorator.ts — @CurrentUser() — so'rovdan user oladi

src/common/filters/
  http-exception.filter.ts  — Xato xabarlarini formatlaydi

src/common/interceptors/
  response.interceptor.ts   — Javob formatini standartlashtiradi
                              { success, data, message, timestamp }

src/common/dto/
  pagination.dto.ts     — page, limit uchun umumiy DTO
  date-range.dto.ts     — from, to uchun umumiy DTO


================================================================
  QISM 5 — LOYHA PAPKALAR TUZILISHI
================================================================

src/
├── main.ts                         Ilovani ishga tushiradi
├── app.module.ts                   Asosiy modul
│
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── refresh.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   └── dto/
│       ├── login.dto.ts
│       └── change-password.dto.ts
│
├── departments/
│   ├── departments.module.ts
│   ├── departments.controller.ts
│   ├── departments.service.ts
│   └── dto/
│       ├── create-department.dto.ts
│       └── update-department.dto.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       ├── create-user.dto.ts
│       ├── update-user.dto.ts
│       └── user-query.dto.ts
│
├── products/
│   ├── products.module.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   └── dto/
│       ├── create-product.dto.ts
│       ├── update-product.dto.ts
│       └── product-query.dto.ts
│
├── inventory/
│   ├── inventory.module.ts
│   ├── inventory.controller.ts
│   ├── inventory.service.ts
│   └── dto/
│       ├── stock-in.dto.ts
│       └── set-min-level.dto.ts
│
├── operations/
│   ├── operations.module.ts
│   ├── operations.controller.ts
│   ├── operations.service.ts
│   └── dto/
│       ├── give-to-user.dto.ts
│       ├── return-from-user.dto.ts
│       ├── transfer-user.dto.ts
│       ├── give-to-dept.dto.ts
│       ├── assign-to-dept.dto.ts
│       └── return-from-dept.dto.ts
│
├── history/
│   ├── history.module.ts
│   ├── history.controller.ts
│   ├── history.service.ts
│   └── dto/
│       └── history-query.dto.ts
│
├── stats/
│   ├── stats.module.ts
│   ├── stats.controller.ts
│   └── stats.service.ts
│
└── common/
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   └── roles.guard.ts
    ├── decorators/
    │   ├── roles.decorator.ts
    │   └── current-user.decorator.ts
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── response.interceptor.ts
    └── dto/
        ├── pagination.dto.ts
        └── date-range.dto.ts


================================================================
  QISM 6 — API JAVOB FORMATI (STANDART)
================================================================

Muvaffaqiyatli javob:
{
  "success": true,
  "data": { ... },
  "message": "Muvaffaqiyatli bajarildi",
  "timestamp": "2025-06-01T10:30:00.000Z"
}

Ro'yxat javobi (pagination bilan):
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}

Xato javobi:
{
  "success": false,
  "error": "INSUFFICIENT_STOCK",
  "message": "Omborда yetarli miqdor yo'q",
  "statusCode": 400,
  "timestamp": "2025-06-01T10:30:00.000Z"
}


================================================================
  QISM 7 — ROL RUXSATLARI JADVALI (TO'LIQ)
================================================================

Endpoint                             ADMIN    OMBORCHI    XODIM
-----------------------------------  -------  ----------  ----------
POST /auth/login                       Ha       Ha          Ha
POST /auth/refresh                     Ha       Ha          Ha
POST /auth/logout                      Ha       Ha          Ha
GET  /auth/me                          Ha       Ha          Ha
PUT  /auth/change-password             Ha       Ha          Ha

GET  /departments                      Ha       Yo'q        Yo'q
GET  /departments/:id                  Ha       Yo'q        Yo'q
GET  /departments/:id/stats            Ha       Ha          Yo'q
POST /departments                      Ha       Yo'q        Yo'q
PUT  /departments/:id                  Ha       Yo'q        Yo'q
DELETE /departments/:id                Ha       Yo'q        Yo'q

GET  /users                            Ha       Yo'q        Yo'q
GET  /users/:id                        Ha       Yo'q        Yo'q
GET  /users/:id/assignments            Ha       Ha          Yo'q
GET  /users/:id/history                Ha       Ha          O'ziniki
POST /users                            Ha       Yo'q        Yo'q
PUT  /users/:id                        Ha       Yo'q        Yo'q
PATCH /users/:id/status                Ha       Yo'q        Yo'q

GET  /products                         Ha       Ha          Ha
GET  /products/:id                     Ha       Ha          Ha
GET  /products/:id/history             Ha       Ha          Yo'q
GET  /products/low-stock               Ha       Ha          Yo'q
POST /products                         Ha       Yo'q        Yo'q
PUT  /products/:id                     Ha       Yo'q        Yo'q
DELETE /products/:id                   Ha       Yo'q        Yo'q

GET  /inventory                        Ha       Ha          Yo'q
GET  /inventory/:productId             Ha       Ha          Yo'q
POST /inventory/stock-in               Ha       Ha          Yo'q
PATCH /inventory/min-level             Ha       Ha          Yo'q
GET  /inventory/low-stock              Ha       Ha          Yo'q

POST /operations/*                     Ha       Ha          Yo'q

GET  /history                          Ha       Ha          O'ziniki

GET  /stats/*                          Ha       Ha          Yo'q


================================================================
  QISM 8 — MUHIM TEXNIK QARORLAR
================================================================

1. TRANSAKSIYA XAVFSIZLIGI
   Barcha operatsiyalar Prisma $transaction ichida.
   Ombor kamayadi + jihoz ko'payadi + tarix yoziladi — hammasi
   bir vaqtda yoki hech biri. Xato bo'lsa rollback.

2. MAHSULOT TURI TEKSHIRUVI
   OperationsService da har operatsiya boshlanishida
   productType tekshiriladi. Printerga GIVE_TO_USER
   deb bo'lmaydi — 400 Bad Request qaytadi.

3. MIQDOR TEKSHIRUVI
   Ombordan ko'proq chiqarib bo'lmaydi.
   Servis darajasida tekshiriladi — yetarli bo'lmasa 400 qaytadi.

4. SOFT DELETE
   User va Product jadvallarida deletedAt.
   O'chirilgan narsalar tarixda saqlanadi.
   So'rovlarda WHERE deletedAt IS NULL qo'shiladi.

5. PAGINATION
   Barcha ro'yxat endpointlarda page + limit.
   Default: page=1, limit=20, max limit=100.

6. QIDIRUV
   ILIKE orqali nom va kod bo'yicha qidiruv.

7. JWT XAVFSIZLIK
   Access token: 15 daqiqa (qisqa umr)
   Refresh token: 30 kun, DB da saqlanadi
   Bloklangan xodim: isActive=false → 401 qaytadi
   Logout: refresh token revokedAt bilan bekor qilinadi

8. INVENTAR RAQAMI
   Har bir ASSET jihozi inventoryNumber bilan kuzatiladi.
   Format: INV-2024-001 (yil + tartib raqami).
   Barcha operatsiyalarda shu raqam ko'rsatiladi.

9. HUJJAT RAQAMI
   Operatsiyalarda documentNumber va documentDate saqlanadi.
   Rasmiy qabul-topshirish aktlarini kuzatish uchun.

10. AUDIT LOG
    Tizim o'zgarishlarining to'liq tarixi (AuditLog).
    Kim, qaysi jadvalda, nima o'zgartirdi, eski/yangi qiymat,
    IP address va browser ma'lumotlari saqlanadi.


================================================================
  QISM 9 — RAQAMLAR XULOSASI
================================================================

  Funksionaliklar soni    :  11 ta
  API endpointlar soni    :  42 ta
  NestJS modullar soni    :  10 ta (AppModule + 9 feature)
  DTO fayllar soni        :  17 ta
  Database jadvallar soni :  10 ta
  Operatsiya turlari      :   7 ta


================================================================
  KEYINGI QADAMLAR (tavsiya tartibi)
================================================================

  1. NestJS loyha yaratish va asosiy sozlamalar
  2. Prisma schema yozish va migration
  3. AuthModule — login, JWT, guard
  4. DepartmentsModule va UsersModule
  5. ProductsModule va InventoryModule
  6. OperationsModule — eng muhim, transaksiyalar
  7. HistoryModule va StatsModule
  8. Testing va deploy

================================================================
  FAYL OXIRI
================================================================
