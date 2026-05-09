import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Hero, HeroType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHeroDto } from './dto/create-hero.dto';
import { UpdateHeroDto } from './dto/update-hero.dto';

@Injectable()
export class HeroService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPageId(pageId: string): Promise<Hero> {
    await this.ensurePageExists(pageId);

    const hero = await this.prisma.hero.findUnique({ where: { pageId } });

    if (!hero) {
      throw new NotFoundException(`Hero for page ${pageId} not found`);
    }

    return hero;
  }

  async create(pageId: string, dto: CreateHeroDto): Promise<Hero> {
    await this.ensurePageExists(pageId);

    const existing = await this.prisma.hero.findUnique({ where: { pageId } });

    if (existing) {
      throw new BadRequestException(`Page ${pageId} already has a hero section`);
    }

    this.validateMediaForType(dto.type, dto.backgroundImageUrl, dto.backgroundVideoUrl);

    return this.prisma.hero.create({
      data: {
        pageId,
        type: dto.type,
        backgroundImageUrl: dto.type === HeroType.IMAGE ? dto.backgroundImageUrl ?? null : null,
        backgroundVideoUrl: dto.type === HeroType.VIDEO ? dto.backgroundVideoUrl ?? null : null,
        slogan: dto.slogan,
        title: dto.title,
        subtitle: dto.subtitle,
        keyPoints: dto.keyPoints ?? [],
        isActive: dto.isActive ?? true,
        order: dto.order,
      },
    });
  }

  async update(pageId: string, dto: CreateHeroDto): Promise<Hero> {
    await this.ensurePageExists(pageId);

    const existing = await this.prisma.hero.findUnique({ where: { pageId } });

    if (!existing) {
      throw new NotFoundException(`Hero for page ${pageId} not found`);
    }

    this.validateMediaForType(dto.type, dto.backgroundImageUrl, dto.backgroundVideoUrl);

    return this.prisma.hero.update({
      where: { pageId },
      data: {
        type: dto.type,
        backgroundImageUrl: dto.type === HeroType.IMAGE ? dto.backgroundImageUrl ?? null : null,
        backgroundVideoUrl: dto.type === HeroType.VIDEO ? dto.backgroundVideoUrl ?? null : null,
        slogan: dto.slogan,
        title: dto.title,
        subtitle: dto.subtitle,
        keyPoints: dto.keyPoints ?? [],
        isActive: dto.isActive ?? true,
        order: dto.order,
      },
    });
  }

  async patch(pageId: string, dto: UpdateHeroDto): Promise<Hero> {
    await this.ensurePageExists(pageId);

    const existing = await this.prisma.hero.findUnique({ where: { pageId } });

    if (!existing) {
      throw new NotFoundException(`Hero for page ${pageId} not found`);
    }

    const nextType = dto.type ?? existing.type;
    const nextBackgroundImageUrl = dto.backgroundImageUrl ?? existing.backgroundImageUrl ?? undefined;
    const nextBackgroundVideoUrl = dto.backgroundVideoUrl ?? existing.backgroundVideoUrl ?? undefined;

    this.validateMediaForType(nextType, nextBackgroundImageUrl, nextBackgroundVideoUrl);

    return this.prisma.hero.update({
      where: { pageId },
      data: {
        type: nextType,
        backgroundImageUrl:
          nextType === HeroType.IMAGE
            ? (dto.backgroundImageUrl ?? existing.backgroundImageUrl ?? null)
            : null,
        backgroundVideoUrl:
          nextType === HeroType.VIDEO
            ? (dto.backgroundVideoUrl ?? existing.backgroundVideoUrl ?? null)
            : null,
        slogan: dto.slogan,
        title: dto.title,
        subtitle: dto.subtitle,
        keyPoints: dto.keyPoints,
        isActive: dto.isActive,
        order: dto.order,
      },
    });
  }

  async remove(pageId: string): Promise<{ deleted: true; pageId: string }> {
    await this.ensurePageExists(pageId);

    const existing = await this.prisma.hero.findUnique({ where: { pageId } });

    if (!existing) {
      throw new NotFoundException(`Hero for page ${pageId} not found`);
    }

    await this.prisma.hero.delete({ where: { pageId } });

    return { deleted: true, pageId };
  }

  private async ensurePageExists(pageId: string): Promise<void> {
    const page = await this.prisma.page.findUnique({ where: { id: pageId }, select: { id: true } });

    if (!page) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
    }
  }

  private validateMediaForType(
    type: HeroType,
    backgroundImageUrl?: string,
    backgroundVideoUrl?: string,
  ): void {
    if (type === HeroType.IMAGE && !backgroundImageUrl) {
      throw new BadRequestException('backgroundImageUrl is required when type is image');
    }

    if (type === HeroType.VIDEO && !backgroundVideoUrl) {
      throw new BadRequestException('backgroundVideoUrl is required when type is video');
    }
  }
}
