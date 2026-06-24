import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { FaqAnswerType, FaqFactCheckStatus, FaqIntentType } from '@prisma/client';

const normalizeAnswerType = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

const normalizeIntentType = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

export class UpdateFaqDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsString()
  short_answer?: string;

  @IsOptional()
  @Transform(normalizeAnswerType)
  @IsEnum(FaqAnswerType, { message: 'answer_type must be text, short, list, steps, comparison, table, or definition' })
  answer_type?: FaqAnswerType;

  @IsOptional()
  @Transform(normalizeIntentType)
  @IsEnum(FaqIntentType, {
    message:
      'intent_type must be definition, pricing, how-to, comparison, shipping, care, return-policy, availability, or troubleshooting',
  })
  intent_type?: FaqIntentType;

  @IsOptional()
  @IsString()
  seo_title?: string;

  @IsOptional()
  @IsString()
  seo_description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  schema_enabled?: boolean;

  @IsOptional()
  @IsString()
  ai_summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entity_tags?: string[];

  @IsOptional()
  @IsString()
  source_url?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value))
  @IsEnum(FaqFactCheckStatus, { message: 'fact_check_status must be pending, verified, needs_review, or rejected' })
  fact_check_status?: FaqFactCheckStatus;

  @IsOptional()
  @IsDateString()
  last_verified_at?: string;

  @IsOptional()
  @IsString()
  context?: string;
}
