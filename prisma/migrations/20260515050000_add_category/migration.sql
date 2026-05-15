CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parent_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "seo_title" TEXT,
  "seo_description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parent_id_order_idx" ON "Category"("parent_id", "order");

ALTER TABLE "Category"
ADD CONSTRAINT "Category_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "Category"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
