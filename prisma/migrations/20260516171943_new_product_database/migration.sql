-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('BOGO', 'PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'BUNDLE', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionConditionType" AS ENUM ('MIN_QTY', 'MIN_CART_VALUE', 'PRODUCT_INCLUDED', 'CATEGORY_INCLUDED', 'BRAND_INCLUDED', 'USER_SEGMENT', 'REGION', 'PAYMENT_METHOD', 'FIRST_ORDER_ONLY');

-- CreateEnum
CREATE TYPE "PromotionTargetType" AS ENUM ('PRODUCT', 'CATEGORY', 'BRAND');

-- CreateEnum
CREATE TYPE "PromotionBenefitType" AS ENUM ('PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'BOGO', 'FREE_SHIPPING', 'BUNDLE');

-- CreateEnum
CREATE TYPE "PromotionDiscountUnit" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "PromotionApplyTo" AS ENUM ('ORDER', 'ITEM', 'SHIPPING');

-- AlterTable
ALTER TABLE "Hero" ALTER COLUMN "keyPoints" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT,
    "description" TEXT,
    "faq_json" JSONB,
    "key_features" TEXT[],
    "materials" TEXT[],
    "specifications" JSONB,
    "use_cases" TEXT[],
    "how_to_use" TEXT,
    "benefits" TEXT[],
    "problem_solved" TEXT,
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "gender" TEXT,
    "age_group" TEXT,
    "material" TEXT,
    "tax_class" TEXT,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "variant_name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "sale_price" DOUBLE PRECISION,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB NOT NULL,
    "barcode" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "image_url" TEXT NOT NULL,
    "alt_text" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSeo" (
    "product_id" TEXT NOT NULL,
    "meta_title" TEXT NOT NULL,
    "meta_description" TEXT NOT NULL,
    "meta_keywords" TEXT,
    "canonical_url" TEXT,
    "slug" TEXT NOT NULL,
    "og_title" TEXT,
    "og_description" TEXT,
    "og_image" TEXT,
    "schema_json" JSONB
);

-- CreateTable
CREATE TABLE "ProductTranslation" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lang_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT,
    "description" TEXT,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFaq" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_image_url" TEXT,
    "comment" TEXT,
    "image_urls" TEXT[],
    "video_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "usage_limit" INTEGER,
    "per_user_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCondition" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "condition_type" "PromotionConditionType" NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "extra_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionTarget" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "target_type" "PromotionTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionBenefit" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "benefit_type" "PromotionBenefitType" NOT NULL,
    "discount_value" DOUBLE PRECISION,
    "discount_unit" "PromotionDiscountUnit",
    "max_discount_amount" DOUBLE PRECISION,
    "buy_qty" INTEGER,
    "get_qty" INTEGER,
    "apply_to" "PromotionApplyTo",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "promotion_id" TEXT NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discount_amount" DOUBLE PRECISION,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_category_id_idx" ON "Product"("category_id");

-- CreateIndex
CREATE INDEX "Product_brand_id_idx" ON "Product"("brand_id");

-- CreateIndex
CREATE INDEX "Product_status_is_published_idx" ON "Product"("status", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_product_id_idx" ON "ProductVariant"("product_id");

-- CreateIndex
CREATE INDEX "ProductVariant_status_is_default_idx" ON "ProductVariant"("status", "is_default");

-- CreateIndex
CREATE INDEX "ProductImage_product_id_sort_order_idx" ON "ProductImage"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "ProductImage_variant_id_idx" ON "ProductImage"("variant_id");

-- CreateIndex
CREATE INDEX "ProductImage_is_primary_idx" ON "ProductImage"("is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSeo_product_id_key" ON "ProductSeo"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSeo_slug_key" ON "ProductSeo"("slug");

-- CreateIndex
CREATE INDEX "ProductTranslation_lang_code_idx" ON "ProductTranslation"("lang_code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTranslation_product_id_lang_code_key" ON "ProductTranslation"("product_id", "lang_code");

-- CreateIndex
CREATE INDEX "ProductFaq_product_id_order_idx" ON "ProductFaq"("product_id", "order");

-- CreateIndex
CREATE INDEX "ProductReview_product_id_idx" ON "ProductReview"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_status_start_at_end_at_idx" ON "Promotion"("status", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "Promotion_priority_idx" ON "Promotion"("priority");

-- CreateIndex
CREATE INDEX "PromotionCondition_promotion_id_idx" ON "PromotionCondition"("promotion_id");

-- CreateIndex
CREATE INDEX "PromotionCondition_condition_type_idx" ON "PromotionCondition"("condition_type");

-- CreateIndex
CREATE INDEX "PromotionTarget_promotion_id_idx" ON "PromotionTarget"("promotion_id");

-- CreateIndex
CREATE INDEX "PromotionTarget_target_type_target_id_idx" ON "PromotionTarget"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "PromotionBenefit_promotion_id_idx" ON "PromotionBenefit"("promotion_id");

-- CreateIndex
CREATE INDEX "PromotionBenefit_benefit_type_idx" ON "PromotionBenefit"("benefit_type");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotion_id_idx" ON "PromotionRedemption"("promotion_id");

-- CreateIndex
CREATE INDEX "PromotionRedemption_user_id_idx" ON "PromotionRedemption"("user_id");

-- CreateIndex
CREATE INDEX "PromotionRedemption_order_id_idx" ON "PromotionRedemption"("order_id");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSeo" ADD CONSTRAINT "ProductSeo_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFaq" ADD CONSTRAINT "ProductFaq_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCondition" ADD CONSTRAINT "PromotionCondition_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionBenefit" ADD CONSTRAINT "PromotionBenefit_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
