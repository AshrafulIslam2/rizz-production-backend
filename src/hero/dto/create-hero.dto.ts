import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { HeroType } from '@prisma/client';

export class CreateHeroDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(HeroType, { message: 'type must be image or video' })
  type!: HeroType;

  @ValidateIf((dto: CreateHeroDto) => dto.type === HeroType.IMAGE)
  @IsString()
  backgroundImageUrl?: string;

  @ValidateIf((dto: CreateHeroDto) => dto.type === HeroType.VIDEO)
  @IsString()
  backgroundVideoUrl?: string;

  @IsOptional()
  @IsString()
  slogan?: string;

  @IsString()
  title!: string;

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
}
