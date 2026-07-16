import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma';
import { CommonModule } from './common';
import { AuthModule } from './modules/auth';
import { DepartmentsModule } from './modules/departments';
import { UsersModule } from './modules/users';
import { ProductsModule } from './modules/products';
import { HistoryModule } from './modules/history/history.module';
import { InventoryModule } from './modules/inventory';
import { OperationsModule } from './modules/operations';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CommonModule,
    DepartmentsModule,
    UsersModule,
    ProductsModule,
    HistoryModule,
    InventoryModule,
    OperationsModule,
    StatsModule,
  ],
})
export class AppModule {}

