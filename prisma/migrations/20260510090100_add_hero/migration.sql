CREATE TYPE "HeroType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "Hero" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "type" "HeroType" NOT NULL,
  "backgroundImageUrl" TEXT,
  "backgroundVideoUrl" TEXT,
  "slogan" TEXT,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Hero_pageId_key" ON "Hero"("pageId");

ALTER TABLE "Hero"
ADD CONSTRAINT "Hero_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "Page"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
