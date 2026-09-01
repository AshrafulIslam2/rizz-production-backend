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
import { AboutModule } from './about/about.module';
import { BlogPostsModule } from './blog-posts/blog-posts.module';
import { StatsModule } from './stats/stats.module';
import { InventoryModule } from './inventory/inventory.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { PosModule } from './pos/pos.module';
import { ReturnsModule } from './returns/returns.module';
import { CrmCustomersModule } from './crm-customers/crm-customers.module';
import { VariantOptionsModule } from './variant-options/variant-options.module';
import { CostingModule } from './costing/costing.module';

@Module({
  imports: [
    PrismaModule,
    AboutModule,
    BlogPostsModule,
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
    StatsModule,
    InventoryModule,
    SuppliersModule,
    PurchaseOrdersModule,
    PosModule,
    ReturnsModule,
    CrmCustomersModule,
    VariantOptionsModule,
    CostingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
