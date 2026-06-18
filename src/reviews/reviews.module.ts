import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [ProductsModule],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
