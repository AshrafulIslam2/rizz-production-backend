import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Prisma, ProductStatus } from '@prisma/client';

const normalizeProductStatus = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

export class CreateProductSeoDto {
  @IsString()
  @IsNotEmpty()
  meta_title!: string;

  @IsString()
  @IsNotEmpty()
  meta_description!: string;

  @IsOptional()
  @IsString()
  meta_keywords?: string;

  @IsOptional()
  @IsString()
  canonical_url?: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  og_title?: string;

  @IsOptional()
  @IsString()
  og_description?: string;

  @IsOptional()
  @IsString()
  og_image?: string;

  @IsOptional()
  @IsObject()
  schema_json?: Prisma.InputJsonValue;
}

export class CreateProductVariantDto {
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  variant_name!: string;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsNumber()
  sale_price?: number;

  @IsOptional()
  @IsInt()
  stock_qty?: number;

  @IsObject()
  attributes!: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @Transform(normalizeProductStatus)
  @IsEnum(ProductStatus, { message: 'status must be draft, active, or archived' })
  status?: ProductStatus;
}

export class CreateProductImageDto {
  @IsOptional()
  @IsString()
  variant_id?: string;

  @IsString()
  @IsNotEmpty()
  image_url!: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}

export class CreateProductTranslationDto {
  @IsString()
  @IsNotEmpty()
  lang_code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  short_description?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  seo_title?: string;

  @IsOptional()
  @IsString()
  seo_description?: string;
}

export class CreateProductFaqDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  lang_code?: string;
}

export class CreateProductReviewDto {
  @IsString()
  @IsNotEmpty()
  customer_name!: string;

  @IsOptional()
  @IsString()
  customer_image_url?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  image_urls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  video_urls?: string[];
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsOptional()
  @IsString()
  short_description?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  key_features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  use_cases?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];


  @IsOptional()
  @IsString()
  brand_id?: string;

  @IsOptional()
  @IsString()
  category_id?: string;

  @IsOptional()
  @Transform(normalizeProductStatus)
  @IsEnum(ProductStatus, { message: 'status must be draft, active, or archived' })
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  age_group?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  tax_class?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProductSeoDto)
  seo?: CreateProductSeoDto;
}
