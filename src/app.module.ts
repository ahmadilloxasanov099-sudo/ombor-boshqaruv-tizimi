import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
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
import { MailModule } from './modules/nodemailer/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    I18nModule.forRoot({
      fallbackLanguage: 'uz',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        new QueryResolver(['lang', 'l']),
        new HeaderResolver(['x-custom-lang']),
        AcceptLanguageResolver,
      ],
    }),
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
    MailModule,
  ],
})
export class AppModule {}
