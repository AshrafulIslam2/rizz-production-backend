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
import { UpdateProductBasicInfoDto } from './dto/update-product-basic-info.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { UpdateMediaDto } from './dto/update-media.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        media: { orderBy: { is_primary: 'desc' } },
        variants: true,
        category: true,
      },
    });
  }

  async findOne(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId } as any,
      include: {
        variants: true,
        images: true,
        media: true,
        seo: true,
        translations: true,
        faqs: true,
        reviews: true,
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    return product;
  }

  async findVariants(productId: string) {
    await this.ensureProductExists(productId);
    return this.prisma.productVariant.findMany({
      where: { product_id: productId } as any,
      orderBy: { created_at: 'desc' },
    });
  }

  async findMedia(productId: string) {
    await this.ensureProductExists(productId);
    return this.prisma.productMedia.findMany({
      where: { product_id: productId } as any,
      orderBy: { sort_order: 'asc' },
    });
  }

  async findFaqs(productId: string) {
    await this.ensureProductExists(productId);
    return this.prisma.productFaq.findMany({
      where: { product_id: productId } as any,
      orderBy: { order: 'asc' },
    });
  }

  async create(dto: CreateProductDto) {
    const sku = dto.sku ?? `RIZZ-${Date.now()}`;
    await this.ensureUniqueSku(sku);
    await this.ensureUniqueSlug(dto.slug);

    if (dto.category_id) {
      await this.ensureCategoryExists(dto.category_id);
    }

    if (dto.seo?.slug) {
      await this.ensureUniqueSeoSlug(dto.seo.slug);
    }

    return this.prisma.product.create({
      data: {
        sku,
        name: dto.name,
        slug: dto.slug,
        short_description: dto.short_description,
        description: dto.description,
        key_features: dto.key_features ?? [],
        materials: dto.materials ?? [],
        use_cases: dto.use_cases ?? [],
        benefits: dto.benefits ?? [],
        brand_id: dto.brand_id ?? '',
        category_id: dto.category_id ?? null,
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
      } as any,
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

  async update(productId: string, dto: UpdateProductDto) {
    await this.ensureProductExists(productId);

    if (dto.category_id) {
      await this.ensureCategoryExists(dto.category_id);
    }

    return this.prisma.product.update({
      where: { id: productId } as any,
      data: dto as any,
    });
  }

  async remove(productId: string) {
    await this.ensureProductExists(productId);
    return this.prisma.product.delete({ where: { id: productId } as any });
  }

  async updateBasicInfo(productId: string, dto: UpdateProductBasicInfoDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id: productId } as any,
    });

    if (!existing) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    if (dto.sku && dto.sku !== existing.sku) {
      await this.ensureUniqueSku(dto.sku);
    }

    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureUniqueSlug(dto.slug);
    }

    if (dto.category_id && dto.category_id !== existing.category_id) {
      await this.ensureCategoryExists(dto.category_id);
    }

    const mergeNullable = <T>(value: T | null | undefined, fallback: T | null) =>
      value === undefined ? fallback : value;
    const mergeRequired = <T>(value: T | null | undefined, fallback: T) => value ?? fallback;
    const mergeJsonNullable = (
      value: Prisma.InputJsonValue | null | undefined,
      fallback: Prisma.InputJsonValue | null,
    ): Prisma.InputJsonValue | Prisma.NullTypes.DbNull => {
      const resolved = value === undefined ? fallback : value;
      return resolved === null ? Prisma.DbNull : resolved;
    };

    return this.prisma.product.update({
      where: { id: productId } as any,
      data: {
        sku: mergeRequired(dto.sku, existing.sku),
        name: mergeRequired(dto.name, existing.name),
        slug: mergeRequired(dto.slug, existing.slug),
        short_description: mergeNullable(dto.short_description, existing.short_description),
        description: mergeNullable(dto.description, existing.description),
        key_features: mergeRequired(dto.key_features, existing.key_features),
        materials: mergeRequired(dto.materials, existing.materials),
        specifications: mergeJsonNullable(dto.specifications, existing.specifications as Prisma.InputJsonValue | null),
        use_cases: mergeRequired(dto.use_cases, existing.use_cases),
        how_to_use: mergeNullable(dto.how_to_use, existing.how_to_use),
        benefits: mergeRequired(dto.benefits, existing.benefits),
        problem_solved: mergeNullable(dto.problem_solved, existing.problem_solved),
        specs: mergeNullable(dto.specs, existing.specs),
        craftsmanship: mergeNullable(dto.craftsmanship, existing.craftsmanship),
        free_delivery: mergeRequired(dto.free_delivery, existing.free_delivery),
        brand_id: mergeRequired(dto.brand_id, existing.brand_id),
        category_id: mergeRequired(dto.category_id, existing.category_id),
        status: mergeRequired(dto.status, existing.status),
        is_featured: mergeRequired(dto.is_featured, existing.is_featured),
        is_published: mergeRequired(dto.is_published, existing.is_published),
        tags: mergeRequired(dto.tags, existing.tags),
        gender: mergeNullable(dto.gender, existing.gender),
        age_group: mergeNullable(dto.age_group, existing.age_group),
        material: mergeNullable(dto.material, existing.material),
        tax_class: mergeNullable(dto.tax_class, existing.tax_class),
        weight: mergeNullable(dto.weight, existing.weight),
        length: mergeNullable(dto.length, existing.length),
        width: mergeNullable(dto.width, existing.width),
        height: mergeNullable(dto.height, existing.height),
      },
      include: {
        variants: true,
        images: true,
        media: true,
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
      } as any,
    });
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateVariantDto) {
    await this.ensureVariantBelongsToProduct(variantId, productId);

    if (dto.sku) {
      const existing = await this.prisma.productVariant.findUnique({ where: { id: variantId } as any });
      if (existing && dto.sku !== existing.sku) {
        await this.ensureUniqueVariantSku(dto.sku);
      }
    }

    return this.prisma.productVariant.update({
      where: { id: variantId } as any,
      data: dto as any,
    });
  }

  async removeVariant(productId: string, variantId: string) {
    await this.ensureVariantBelongsToProduct(variantId, productId);
    return this.prisma.productVariant.delete({ where: { id: variantId } as any });
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
      } as any,
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
      } as any,
    });
  }

  async getTranslations(productId: string) {
    await this.ensureProductExists(productId);
    return this.prisma.productTranslation.findMany({
      where: { product_id: productId } as any,
      orderBy: { lang_code: 'asc' },
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
      } as any,
    });
  }

  async upsertTranslation(productId: string, lang: string, dto: Omit<CreateProductTranslationDto, 'lang_code'>) {
    await this.ensureProductExists(productId);

    return this.prisma.productTranslation.upsert({
      where: { product_id_lang_code: { product_id: productId, lang_code: lang } } as any,
      create: {
        product_id: productId,
        lang_code: lang,
        name: dto.name,
        short_description: dto.short_description,
        description: dto.description,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
      } as any,
      update: {
        name: dto.name,
        short_description: dto.short_description,
        description: dto.description,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
      } as any,
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
        lang_code: dto.lang_code ?? 'en',
      } as any,
    });
  }

  async updateFaq(productId: string, faqId: string, dto: UpdateFaqDto) {
    await this.ensureFaqBelongsToProduct(faqId, productId);
    return this.prisma.productFaq.update({
      where: { id: faqId } as any,
      data: dto as any,
    });
  }

  async removeFaq(productId: string, faqId: string) {
    await this.ensureFaqBelongsToProduct(faqId, productId);
    return this.prisma.productFaq.delete({ where: { id: faqId } as any });
  }

  async createReview(productId: string, dto: CreateProductReviewDto) {
    await this.ensureProductExists(productId);

    return this.prisma.productReview.create({
      data: {
        product_id: productId,
        customer_name: dto.customer_name,
        customer_image_url: dto.customer_image_url,
        comment: dto.comment,
        rating: dto.rating,
        status: dto.status ?? 'active',
        image_urls: dto.image_urls ?? [],
        video_urls: dto.video_urls ?? [],
      } as any,
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
      } as any,
    });
  }

  async updateMedia(productId: string, mediaId: string, dto: UpdateMediaDto) {
    await this.ensureMediaBelongsToProduct(mediaId, productId);
    return this.prisma.productMedia.update({
      where: { id: mediaId } as any,
      data: dto as any,
    });
  }

  async removeMedia(productId: string, mediaId: string) {
    await this.ensureMediaBelongsToProduct(mediaId, productId);
    return this.prisma.productMedia.delete({ where: { id: mediaId } as any });
  }

  // ---- Reviews global ----
  async findAllReviews(productId?: string, status?: string) {
    const where: any = {};
    if (productId) where.product_id = productId;
    if (status) where.status = status;

    return this.prisma.productReview.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { product: { select: { id: true, name: true, slug: true } } },
    });
  }

  async updateReview(reviewId: string, dto: { status?: string; comment?: string; customer_name?: string; customer_image_url?: string; rating?: number }) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } as any });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);
    return this.prisma.productReview.update({ where: { id: reviewId } as any, data: dto as any });
  }

  async removeReview(reviewId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } as any });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);
    return this.prisma.productReview.delete({ where: { id: reviewId } as any });
  }

  // ---- Private helpers ----
  private async ensureProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId } as any,
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product with id ${productId} not found`);
  }

  private async ensureCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId } as any,
      select: { id: true },
    });
    if (!category) throw new NotFoundException(`Category with id ${categoryId} not found`);
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
    if (!variant) throw new NotFoundException(`Variant with id ${variantId} not found`);
    if (variant.product_id !== productId)
      throw new BadRequestException('variant does not belong to this product');
  }

  private async ensureFaqBelongsToProduct(faqId: string, productId: string): Promise<void> {
    const faq = await this.prisma.productFaq.findUnique({
      where: { id: faqId } as any,
      select: { id: true, product_id: true },
    });
    if (!faq) throw new NotFoundException(`FAQ with id ${faqId} not found`);
    if (faq.product_id !== productId)
      throw new BadRequestException('FAQ does not belong to this product');
  }

  private async ensureMediaBelongsToProduct(mediaId: string, productId: string): Promise<void> {
    const media = await this.prisma.productMedia.findUnique({
      where: { id: mediaId } as any,
      select: { id: true, product_id: true },
    });
    if (!media) throw new NotFoundException(`Media with id ${mediaId} not found`);
    if (media.product_id !== productId)
      throw new BadRequestException('Media does not belong to this product');
  }
}
