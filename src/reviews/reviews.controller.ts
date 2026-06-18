import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ProductsService } from '../products/products.service';

class UpdateReviewDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.findAllReviews(productId, status);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.productsService.updateReview(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.removeReview(id);
  }
}
