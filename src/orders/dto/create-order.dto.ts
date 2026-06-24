import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  customer_name!: string;

  @IsString()
  customer_phone!: string;

  @IsOptional()
  @IsString()
  customer_email?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsString()
  address!: string;

  @IsArray()
  items!: any[];

  @IsNumber()
  subtotal!: number;

  @IsOptional()
  @IsNumber()
  shipping_fee?: number;

  @IsOptional()
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsString()
  promo_code?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  campaign_ids?: string[];

  @IsOptional()
  @IsArray()
  free_gifts?: any[];

  @IsNumber()
  total!: number;

  @IsOptional()
  @IsString()
  payment_method?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
