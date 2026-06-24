import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Prisma, ProductStatus } from '@prisma/client';

const normalizeProductStatus = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

export class UpdateProductBasicInfoDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  short_description?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  key_features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @IsOptional()
  @IsObject()
  specifications?: Prisma.InputJsonValue | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  use_cases?: string[];

  @IsOptional()
  @IsString()
  how_to_use?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsString()
  specs?: string | null;

  @IsOptional()
  @IsString()
  craftsmanship?: string | null;

  @IsOptional()
  @IsBoolean()
  free_delivery?: boolean;

  @IsOptional()
  @IsString()
  problem_solved?: string | null;

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
  gender?: string | null;

  @IsOptional()
  @IsString()
  age_group?: string | null;

  @IsOptional()
  @IsString()
  material?: string | null;

  @IsOptional()
  @IsString()
  tax_class?: string | null;

  @IsOptional()
  @IsNumber()
  weight?: number | null;

  @IsOptional()
  @IsNumber()
  length?: number | null;

  @IsOptional()
  @IsNumber()
  width?: number | null;

  @IsOptional()
  @IsNumber()
  height?: number | null;
}