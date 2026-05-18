import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  CreateProductDto,
  CreateProductFaqDto,
  CreateProductImageDto,
  CreateProductReviewDto,
  CreateProductSeoDto,
  CreateProductTranslationDto,
  CreateProductVariantDto,
} from './dto/create-product.dto';
import { CreateProductMediaDto } from './dto/create-media.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':productId')
  findOne(@Param('productId') productId: string) {
    return this.productsService.findOne(productId);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post(':productId/variants')
  createVariant(@Param('productId') productId: string, @Body() dto: CreateProductVariantDto) {
    return this.productsService.createVariant(productId, dto);
  }

  @Post(':productId/images')
  createImage(@Param('productId') productId: string, @Body() dto: CreateProductImageDto) {
    return this.productsService.createImage(productId, dto);
  }

  @Post(':productId/seo')
  createSeo(@Param('productId') productId: string, @Body() dto: CreateProductSeoDto) {
    return this.productsService.createSeo(productId, dto);
  }

  @Post(':productId/translations')
  createTranslation(
    @Param('productId') productId: string,
    @Body() dto: CreateProductTranslationDto,
  ) {
    return this.productsService.createTranslation(productId, dto);
  }

  @Post(':productId/faqs')
  createFaq(@Param('productId') productId: string, @Body() dto: CreateProductFaqDto) {
    return this.productsService.createFaq(productId, dto);
  }

  @Post(':productId/reviews')
  createReview(@Param('productId') productId: string, @Body() dto: CreateProductReviewDto) {
    return this.productsService.createReview(productId, dto);
  }

  @Post(':productId/media')
  createMedia(@Param('productId') productId: string, @Body() dto: CreateProductMediaDto) {
    return this.productsService.createMedia(productId, dto);
  }
}
