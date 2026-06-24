import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
import { FaqAnswerType, FaqFactCheckStatus, FaqIntentType } from '@prisma/client';

const normalizeAnswerType = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

const normalizeIntentType = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value;

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;

  @IsString()
  @IsNotEmpty()
  short_answer!: string;

  @Transform(normalizeAnswerType)
  @IsEnum(FaqAnswerType, { message: 'answer_type must be text, short, list, steps, comparison, table, or definition' })
  answer_type!: FaqAnswerType;

  @Transform(normalizeIntentType)
  @IsEnum(FaqIntentType, {
    message:
      'intent_type must be definition, pricing, how-to, comparison, shipping, care, return-policy, availability, or troubleshooting',
  })
  intent_type!: FaqIntentType;

  @IsString()
  @IsNotEmpty()
  seo_title!: string;

  @IsString()
  @IsNotEmpty()
  seo_description!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsBoolean()
  schema_enabled!: boolean;

  @IsString()
  @IsNotEmpty()
  ai_summary!: string;

  @IsArray()
  @IsString({ each: true })
  entity_tags!: string[];

  @IsString()
  @IsNotEmpty()
  source_url!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().replace(/[-\s]/g, '_') : value))
  @IsEnum(FaqFactCheckStatus, { message: 'fact_check_status must be pending, verified, needs_review, or rejected' })
  fact_check_status!: FaqFactCheckStatus;

  @IsDateString()
  last_verified_at!: string;

  @IsString()
  @IsNotEmpty()
  context!: string;
}
