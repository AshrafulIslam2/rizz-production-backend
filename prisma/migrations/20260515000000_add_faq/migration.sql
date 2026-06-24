CREATE TYPE "FaqAnswerType" AS ENUM ('TEXT', 'SHORT', 'LIST', 'STEPS', 'COMPARISON', 'TABLE', 'DEFINITION');
CREATE TYPE "FaqIntentType" AS ENUM ('DEFINITION', 'PRICING', 'HOW_TO', 'COMPARISON', 'SHIPPING', 'CARE', 'RETURN_POLICY', 'AVAILABILITY', 'TROUBLESHOOTING');
CREATE TYPE "FaqFactCheckStatus" AS ENUM ('PENDING', 'VERIFIED', 'NEEDS_REVIEW', 'REJECTED');

CREATE TABLE "Faq" (
  "id" TEXT NOT NULL,
  "page_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "short_answer" TEXT NOT NULL,
  "answer_type" "FaqAnswerType" NOT NULL,
  "intent_type" "FaqIntentType" NOT NULL,
  "seo_title" TEXT NOT NULL,
  "seo_description" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "schema_enabled" BOOLEAN NOT NULL DEFAULT true,
  "ai_summary" TEXT NOT NULL,
  "entity_tags" TEXT[] NOT NULL,
  "source_url" TEXT NOT NULL,
  "fact_check_status" "FaqFactCheckStatus" NOT NULL,
  "last_verified_at" TIMESTAMP(3) NOT NULL,
  "context" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Faq_page_id_slug_key" ON "Faq"("page_id", "slug");
CREATE INDEX "Faq_page_id_idx" ON "Faq"("page_id");

ALTER TABLE "Faq"
ADD CONSTRAINT "Faq_page_id_fkey"
FOREIGN KEY ("page_id") REFERENCES "Page"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
