import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'src/prisma';
import { AuthModule } from './modules/auth';
import { DepartmentsModule } from './modules/departments';
import { UsersModule } from './modules/users';
import { ProductsModule } from './modules/products';
import { InventoryModule } from './modules/inventory';
import { OperationsModule } from './modules/operations';
import { HistoryModule } from './modules/history/history.module';
import { StatsModule } from './modules/stats/stats.module';
import { CommonModule } from './common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    AuthModule,
    DepartmentsModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    OperationsModule,
    HistoryModule,
    StatsModule,
  ],
})
export class AppModule {}
