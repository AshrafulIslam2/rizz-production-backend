import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  requires_code?: boolean;

  /** PERCENT | FIXED | BOGO | null (no price discount — e.g. free-shipping/gift-only campaign) */
  @IsOptional()
  @IsString()
  discount_type?: string;

  @IsOptional()
  @IsNumber()
  discount_value?: number;

  @IsOptional()
  @IsInt()
  buy_qty?: number;

  @IsOptional()
  @IsInt()
  get_qty?: number;

  @IsOptional()
  @IsBoolean()
  free_shipping?: boolean;

  @IsOptional()
  @IsString()
  free_gift_product_id?: string;

  @IsOptional()
  @IsInt()
  usage_limit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product_ids?: string[];

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
