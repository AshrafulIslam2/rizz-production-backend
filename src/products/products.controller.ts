import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
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
import { UpdateProductBasicInfoDto } from './dto/update-product-basic-info.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  @Patch(':productId')
  update(@Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(productId, dto);
  }

  @Delete(':productId')
  remove(@Param('productId') productId: string) {
    return this.productsService.remove(productId);
  }

  @Patch(':productId/basic-info')
  updateBasicInfo(@Param('productId') productId: string, @Body() dto: UpdateProductBasicInfoDto) {
    return this.productsService.updateBasicInfo(productId, dto);
  }

  // Variants
  @Post(':productId/variants')
  createVariant(@Param('productId') productId: string, @Body() dto: CreateProductVariantDto) {
    return this.productsService.createVariant(productId, dto);
  }

  @Get(':productId/variants')
  findVariants(@Param('productId') productId: string) {
    return this.productsService.findVariants(productId);
  }

  @Patch(':productId/variants/:variantId')
  updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  removeVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.removeVariant(productId, variantId);
  }

  // Images
  @Post(':productId/images')
  createImage(@Param('productId') productId: string, @Body() dto: CreateProductImageDto) {
    return this.productsService.createImage(productId, dto);
  }

  // Media
  @Post(':productId/media')
  createMedia(@Param('productId') productId: string, @Body() dto: CreateProductMediaDto) {
    return this.productsService.createMedia(productId, dto);
  }

  @Get(':productId/media')
  findMedia(@Param('productId') productId: string) {
    return this.productsService.findMedia(productId);
  }

  @Patch(':productId/media/:mediaId')
  updateMedia(
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.productsService.updateMedia(productId, mediaId, dto);
  }

  @Delete(':productId/media/:mediaId')
  removeMedia(
    @Param('productId') productId: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.productsService.removeMedia(productId, mediaId);
  }

  @Post(':productId/media/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadMedia(
    @Param('productId') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt_text') altText?: string,
    @Body('title') title?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const { url } = await this.cloudinaryService.uploadFile(file.buffer, file.mimetype);
    const media_type = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
    return this.productsService.createMedia(productId, {
      media_url: url,
      media_type,
      alt_text: altText,
      title,
    } as any);
  }

  // SEO
  @Post(':productId/seo')
  createSeo(@Param('productId') productId: string, @Body() dto: CreateProductSeoDto) {
    return this.productsService.createSeo(productId, dto);
  }

  // Translations
  @Post(':productId/translations')
  createTranslation(
    @Param('productId') productId: string,
    @Body() dto: CreateProductTranslationDto,
  ) {
    return this.productsService.createTranslation(productId, dto);
  }

  // FAQs
  @Post(':productId/faqs')
  createFaq(@Param('productId') productId: string, @Body() dto: CreateProductFaqDto) {
    return this.productsService.createFaq(productId, dto);
  }

  @Get(':productId/faqs')
  findFaqs(@Param('productId') productId: string) {
    return this.productsService.findFaqs(productId);
  }

  @Patch(':productId/faqs/:faqId')
  updateFaq(
    @Param('productId') productId: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.productsService.updateFaq(productId, faqId, dto);
  }

  @Delete(':productId/faqs/:faqId')
  removeFaq(
    @Param('productId') productId: string,
    @Param('faqId') faqId: string,
  ) {
    return this.productsService.removeFaq(productId, faqId);
  }

  // Reviews
  @Post(':productId/reviews')
  createReview(@Param('productId') productId: string, @Body() dto: CreateProductReviewDto) {
    return this.productsService.createReview(productId, dto);
  }
}
