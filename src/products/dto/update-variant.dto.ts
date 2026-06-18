import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma, ProductStatus } from '@prisma/client';

const normalizeStatus = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  variant_name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  sale_price?: number;

  @IsOptional()
  @IsInt()
  stock_qty?: number;

  @IsOptional()
  @IsObject()
  attributes?: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @Transform(normalizeStatus)
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
