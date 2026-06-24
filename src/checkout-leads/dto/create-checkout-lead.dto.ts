import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsNumber()
  cart_total?: number;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  company_name?: string;
}
