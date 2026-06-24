import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductViewsController } from './product-views.controller';
import { ProductViewsService } from './product-views.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductViewsController],
  providers: [ProductViewsService],
})
export class ProductViewsModule {}
