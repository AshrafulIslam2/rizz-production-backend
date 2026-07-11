import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateBlogPostDto {
  @IsString()
  title!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  reading_time?: number;

  @IsOptional()
  @IsString()
  cover_image?: string;

  @IsOptional()
  @IsString()
  cover_alt?: string;

  @IsOptional()
  body?: any[];

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsOptional()
  @IsString()
  published_at?: string;
}
