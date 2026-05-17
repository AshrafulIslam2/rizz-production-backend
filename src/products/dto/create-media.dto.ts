import { IsEnum, IsNotEmpty, IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';
import { MediaType, ProductStatus } from '@prisma/client';

export class CreateProductMediaDto {
  @IsString()
  @IsNotEmpty()
  media_url!: string;

  @IsEnum(MediaType)
  media_type!: MediaType;

  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  variant_id?: string;
}
