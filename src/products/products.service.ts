import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductMediaDto } from './dto/create-media.dto';
import {
  CreateProductDto,
  CreateProductFaqDto,
  CreateProductImageDto,
  CreateProductReviewDto,
  CreateProductSeoDto,
  CreateProductTranslationDto,
  CreateProductVariantDto,
} from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    await this.ensureUniqueSku(dto.sku);
    await this.ensureUniqueSlug(dto.slug);
    await this.ensureCategoryExists(dto.category_id);

    if (dto.seo?.slug) {
      await this.ensureUniqueSeoSlug(dto.seo.slug);
    }

    return this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug: dto.slug,
        short_description: dto.short_description,
        description: dto.description,
        key_features: dto.key_features ?? [],
        materials: dto.materials ?? [],
        use_cases: dto.use_cases ?? [],
        benefits: dto.benefits ?? [],
        brand_id: dto.brand_id,
        category_id: dto.category_id,
        status: dto.status,
        is_featured: dto.is_featured ?? false,
        is_published: dto.is_published ?? false,
        tags: dto.tags ?? [],
        gender: dto.gender,
        age_group: dto.age_group,
        material: dto.material,
        tax_class: dto.tax_class,
        seo: dto.seo
          ? {
              create: {
                meta_title: dto.seo.meta_title,
                meta_description: dto.seo.meta_description,
                meta_keywords: dto.seo.meta_keywords,
                canonical_url: dto.seo.canonical_url,
                slug: dto.seo.slug,
                og_title: dto.seo.og_title,
                og_description: dto.seo.og_description,
                og_image: dto.seo.og_image,
                schema_json: dto.seo.schema_json as Prisma.InputJsonValue | undefined,
              },
            }
          : undefined,
      },
      include: {
        variants: true,
        images: true,
        seo: true,
        translations: true,
        faqs: true,
        reviews: true,
      },
    });
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    await this.ensureProductExists(productId);
    await this.ensureUniqueVariantSku(dto.sku);

    return this.prisma.productVariant.create({
      data: {
        product_id: productId,
        sku: dto.sku,
        variant_name: dto.variant_name,
        price: dto.price,
        sale_price: dto.sale_price,
        stock_qty: dto.stock_qty ?? 0,
        attributes: dto.attributes as Prisma.InputJsonValue,
        barcode: dto.barcode,
        is_default: dto.is_default ?? false,
        status: dto.status,
      },
    });
  }

  async createImage(productId: string, dto: CreateProductImageDto) {
    await this.ensureProductExists(productId);

    if (dto.variant_id) {
      await this.ensureVariantBelongsToProduct(dto.variant_id, productId);
    }

    return this.prisma.productImage.create({
      data: {
        product_id: productId,
        variant_id: dto.variant_id ?? null,
        image_url: dto.image_url,
        alt_text: dto.alt_text,
        is_primary: dto.is_primary ?? false,
        sort_order: dto.sort_order ?? 0,
      },
    });
  }

  async createSeo(productId: string, dto: CreateProductSeoDto) {
    await this.ensureProductExists(productId);
    await this.ensureUniqueSeoSlug(dto.slug);

    const existing = await this.prisma.productSeo.findUnique({ where: { product_id: productId } as any });
    if (existing) throw new BadRequestException('seo already exists for this product');

    return this.prisma.productSeo.create({
      data: {
        product_id: productId,
        meta_title: dto.meta_title,
        meta_description: dto.meta_description,
        meta_keywords: dto.meta_keywords,
        canonical_url: dto.canonical_url,
        slug: dto.slug,
        og_title: dto.og_title,
        og_description: dto.og_description,
        og_image: dto.og_image,
        schema_json: dto.schema_json as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async createTranslation(productId: string, dto: CreateProductTranslationDto) {
    await this.ensureProductExists(productId);

    return this.prisma.productTranslation.create({
      data: {
        product_id: productId,
        lang_code: dto.lang_code,
        name: dto.name,
        short_description: dto.short_description,
        description: dto.description,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
      },
    });
  }

  async createFaq(productId: string, dto: CreateProductFaqDto) {
    await this.ensureProductExists(productId);

    return this.prisma.productFaq.create({
      data: {
        product_id: productId,
        question: dto.question,
        answer: dto.answer,
        order: dto.order ?? 0,
      },
    });
  }

  async createReview(productId: string, dto: CreateProductReviewDto) {
    await this.ensureProductExists(productId);

    return this.prisma.productReview.create({
      data: {
        product_id: productId,
        customer_name: dto.customer_name,
        customer_image_url: dto.customer_image_url,
        comment: dto.comment,
        image_urls: dto.image_urls ?? [],
        video_urls: dto.video_urls ?? [],
      },
    });
  }

  async createMedia(productId: string, dto: CreateProductMediaDto) {
    await this.ensureProductExists(productId);

    if (dto.variant_id) {
      await this.ensureVariantBelongsToProduct(dto.variant_id, productId);
    }

    return this.prisma.productMedia.create({
      data: {
        product_id: productId,
        variant_id: dto.variant_id ?? null,
        media_type: dto.media_type,
        media_url: dto.media_url,
        thumbnail_url: dto.thumbnail_url,
        alt_text: dto.alt_text,
        title: dto.title,
        sort_order: dto.sort_order ?? 0,
        is_primary: dto.is_primary ?? false,
        is_featured: dto.is_featured ?? false,
        status: dto.status ? (dto.status as any) : undefined,
      },
    });
  }

  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId } as any,
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }

  private async ensureCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId } as any,
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
  }

  private async ensureUniqueSku(sku: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { sku } as any });
    if (existing) throw new BadRequestException('sku must be unique');
  }

  private async ensureUniqueSlug(slug: string): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { slug } as any });
    if (existing) throw new BadRequestException('slug must be unique');
  }

  private async ensureUniqueSeoSlug(slug: string): Promise<void> {
    const existing = await this.prisma.productSeo.findUnique({ where: { slug } as any });
    if (existing) throw new BadRequestException('seo slug must be unique');
  }

  private async ensureUniqueVariantSku(sku: string): Promise<void> {
    const existing = await this.prisma.productVariant.findUnique({ where: { sku } as any });
    if (existing) throw new BadRequestException('variant sku must be unique');
  }

  private async ensureVariantBelongsToProduct(variantId: string, productId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId } as any,
      select: { id: true, product_id: true },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with id ${variantId} not found`);
    }

    if (variant.product_id !== productId) {
      throw new BadRequestException('variant does not belong to this product');
    }
  }
}
