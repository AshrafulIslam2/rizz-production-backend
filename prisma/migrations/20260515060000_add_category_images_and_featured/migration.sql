ALTER TABLE "Category"
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "show_on_homepage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thumbnail_image" TEXT,
ADD COLUMN "banner_image" TEXT;
