import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Faq,
  FaqAnswerType,
  FaqFactCheckStatus,
  FaqIntentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

type JsonLdFaqPage = {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
};

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPageId(pageId: string): Promise<{ faqs: Faq[]; schema: JsonLdFaqPage }> {
    await this.ensurePageExists(pageId);

    const faqs = await this.prisma.faq.findMany({
      where: { page_id: pageId },
      orderBy: [{ created_at: 'asc' }],
    });

    return {
      faqs,
      schema: this.buildJsonLd(faqs),
    };
  }

  async findSchemaByPageId(pageId: string): Promise<JsonLdFaqPage> {
    await this.ensurePageExists(pageId);

    const faqs = await this.prisma.faq.findMany({
      where: { page_id: pageId, schema_enabled: true },
      orderBy: [{ created_at: 'asc' }],
    });

    return this.buildJsonLd(faqs);
  }

  async findOne(pageId: string, faqId: string): Promise<{ faq: Faq; schema: JsonLdFaqPage }> {
    const faq = await this.findByPageIdAndId(pageId, faqId);
    const faqs = await this.prisma.faq.findMany({
      where: { page_id: pageId },
      orderBy: [{ created_at: 'asc' }],
    });

    return {
      faq,
      schema: this.buildJsonLd(faqs),
    };
  }

  async create(pageId: string, dto: CreateFaqDto): Promise<Faq> {
    await this.ensurePageExists(pageId);

    this.assertValidFaq(dto);

    return this.prisma.faq.create({
      data: {
        page_id: pageId,
        question: dto.question,
        answer: dto.answer,
        short_answer: dto.short_answer,
        answer_type: dto.answer_type,
        intent_type: dto.intent_type,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
        slug: dto.slug,
        schema_enabled: dto.schema_enabled,
        ai_summary: dto.ai_summary,
        entity_tags: dto.entity_tags,
        source_url: dto.source_url,
        fact_check_status: dto.fact_check_status,
        last_verified_at: dto.last_verified_at,
        context: dto.context,
      },
    });
  }

  async update(pageId: string, faqId: string, dto: CreateFaqDto): Promise<Faq> {
    const existing = await this.findByPageIdAndId(pageId, faqId);

    this.assertValidFaq(dto);

    return this.prisma.faq.update({
      where: { id: existing.id },
      data: {
        question: dto.question,
        answer: dto.answer,
        short_answer: dto.short_answer,
        answer_type: dto.answer_type,
        intent_type: dto.intent_type,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
        slug: dto.slug,
        schema_enabled: dto.schema_enabled,
        ai_summary: dto.ai_summary,
        entity_tags: dto.entity_tags,
        source_url: dto.source_url,
        fact_check_status: dto.fact_check_status,
        last_verified_at: dto.last_verified_at,
        context: dto.context,
      },
    });
  }

  async patch(pageId: string, faqId: string, dto: UpdateFaqDto): Promise<Faq> {
    const existing = await this.findByPageIdAndId(pageId, faqId);

    const nextAnswerType = dto.answer_type ?? existing.answer_type;
    const nextIntentType = dto.intent_type ?? existing.intent_type;
    const nextFactCheckStatus = dto.fact_check_status ?? existing.fact_check_status;

    this.assertValidFaqTypes(nextAnswerType, nextIntentType, nextFactCheckStatus);

    return this.prisma.faq.update({
      where: { id: existing.id },
      data: {
        question: dto.question,
        answer: dto.answer,
        short_answer: dto.short_answer,
        answer_type: nextAnswerType,
        intent_type: nextIntentType,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
        slug: dto.slug,
        schema_enabled: dto.schema_enabled,
        ai_summary: dto.ai_summary,
        entity_tags: dto.entity_tags,
        source_url: dto.source_url,
        fact_check_status: nextFactCheckStatus,
        last_verified_at: dto.last_verified_at,
        context: dto.context,
      },
    });
  }

  async remove(pageId: string, faqId: string): Promise<{ deleted: true; id: string; page_id: string }> {
    const existing = await this.findByPageIdAndId(pageId, faqId);

    await this.prisma.faq.delete({ where: { id: existing.id } });

    return { deleted: true, id: existing.id, page_id: pageId };
  }

  private async findByPageIdAndId(pageId: string, faqId: string): Promise<Faq> {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, page_id: pageId },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ with id ${faqId} for page ${pageId} not found`);
    }

    return faq;
  }

  private async ensurePageExists(pageId: string): Promise<void> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId }, select: { id: true } });

    if (!page) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
    }
  }

  private assertValidFaq(dto: CreateFaqDto | UpdateFaqDto): void {
    this.assertValidFaqTypes(dto.answer_type, dto.intent_type, dto.fact_check_status);
  }

  private assertValidFaqTypes(
    answerType?: FaqAnswerType,
    intentType?: FaqIntentType,
    factCheckStatus?: FaqFactCheckStatus,
  ): void {
    if (answerType && !Object.values(FaqAnswerType).includes(answerType)) {
      throw new BadRequestException('answer_type must be one of text, short, list, steps, comparison, table, definition');
    }

    if (intentType && !Object.values(FaqIntentType).includes(intentType)) {
      throw new BadRequestException(
        'intent_type must be one of definition, pricing, how-to, comparison, shipping, care, return-policy, availability, troubleshooting',
      );
    }

    if (factCheckStatus && !Object.values(FaqFactCheckStatus).includes(factCheckStatus)) {
      throw new BadRequestException('fact_check_status must be a valid FAQ fact check status');
    }
  }

  private buildJsonLd(faqs: Faq[]): JsonLdFaqPage {
    const enabledFaqs = faqs.filter((faq) => faq.schema_enabled);

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: enabledFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };
  }
}
