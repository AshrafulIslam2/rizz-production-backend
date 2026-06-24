import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';
import { HeroType } from '@prisma/client';

export class UpdateHeroDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(HeroType, { message: 'type must be image or video' })
  type?: HeroType;

  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;

  @IsOptional()
  @IsString()
  backgroundVideoUrl?: string;

  @IsOptional()
  @IsString()
  slogan?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyPoints?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;

  @IsOptional()
  @IsDateString()
  updatedAt?: string;
}
