-- Additive only: preserves existing products and allows an already db-pushed database.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "focus_keyword" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "secondary_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "long_tail_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "geo_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seo_heading" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seo_content" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seo_content_bn" TEXT;
