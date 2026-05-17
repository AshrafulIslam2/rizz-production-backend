import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FaqModule } from './faq/faq.module';
import { CategoriesModule } from './categories/categories.module';
import { HeroModule } from './hero/hero.module';
import { PrismaModule } from './prisma/prisma.module';
import { PagesModule } from './pages/pages.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, PagesModule, HeroModule, FaqModule, CategoriesModule, ProductsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
