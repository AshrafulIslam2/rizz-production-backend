import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMediaDto {
  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  /**
   * Colour name this image shows. Send an empty string to untag it, which
   * makes the image show for every colour again.
   */
  @IsOptional()
  @IsString()
  color?: string;
}
