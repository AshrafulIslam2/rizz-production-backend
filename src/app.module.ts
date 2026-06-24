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
import { UploadsModule } from './uploads/uploads.module';
import { SeoModule } from './seo/seo.module';
import { CheckoutLeadsModule } from './checkout-leads/checkout-leads.module';
import { ProductViewsModule } from './product-views/product-views.module';
import { DeliverySettingsModule } from './delivery-settings/delivery-settings.module';

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
    UploadsModule,
    SeoModule,
    CheckoutLeadsModule,
    ProductViewsModule,
    DeliverySettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
