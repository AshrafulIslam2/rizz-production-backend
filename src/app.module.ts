import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FaqModule } from './faq/faq.module';
import { CategoriesModule } from './categories/categories.module';
import { HeroModule } from './hero/hero.module';
import { PrismaModule } from './prisma/prisma.module';
import { PagesModule } from './pages/pages.module';
import { ProductsModule } from './products/products.module';
import { ReviewsModule } from './reviews/reviews.module';
import { OrdersModule } from './orders/orders.module';
import { BrandingModule } from './branding/branding.module';
import { HomepageModule } from './homepage/homepage.module';
import { PoliciesModule } from './policies/policies.module';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
  imports: [
    PrismaModule,
    PagesModule,
    HeroModule,
    FaqModule,
    CategoriesModule,
    ProductsModule,
    ReviewsModule,
    OrdersModule,
    BrandingModule,
    HomepageModule,
    PoliciesModule,
    CampaignsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
