import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CartItemDto {
  @IsString()
  product_id!: string;

  @IsNumber()
  price!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CalculateCartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items!: CartItemDto[];

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  shipping_fee?: number;
}
