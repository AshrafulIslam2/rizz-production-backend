import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: [{ order: 'asc' }, { created_at: 'asc' }] as any });
  }

  async findOne(id: string): Promise<Category> {
    const cat = await this.prisma.category.findUnique({ where: { id } as any });
    if (!cat) throw new NotFoundException(`Category with id ${id} not found`);
    return cat;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    await this.ensureUniqueSlug(dto.slug);

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parent_id: dto.parent_id ?? null,
        is_active: dto.is_active ?? true,
        is_featured: dto.is_featured ?? false,
        show_on_homepage: dto.show_on_homepage ?? false,
        thumbnail_image: dto.thumbnail_image,
        banner_image: dto.banner_image,
        seo_title: dto.seo_title,
        seo_description: dto.seo_description,
        order: dto.order ?? 0,
      },
    });
  }

  async update(id: string, dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.findOne(id);
    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureUniqueSlug(dto.slug);
    }

    return this.prisma.category.update({ where: { id } as any, data: {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      parent_id: dto.parent_id ?? null,
      is_active: dto.is_active ?? existing.is_active,
      is_featured: dto.is_featured ?? existing.is_featured,
      show_on_homepage: dto.show_on_homepage ?? existing.show_on_homepage,
      thumbnail_image: dto.thumbnail_image ?? existing.thumbnail_image,
      banner_image: dto.banner_image ?? existing.banner_image,
      seo_title: dto.seo_title,
      seo_description: dto.seo_description,
      order: dto.order ?? existing.order,
    }});
  }

  async patch(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const existing = await this.findOne(id);
    if (dto.slug && dto.slug !== existing.slug) {
      await this.ensureUniqueSlug(dto.slug);
    }

    return this.prisma.category.update({ where: { id } as any, data: {
      name: dto.name ?? existing.name,
      slug: dto.slug ?? existing.slug,
      description: dto.description ?? existing.description,
      parent_id: dto.parent_id ?? existing.parent_id,
      is_active: dto.is_active ?? existing.is_active,
      is_featured: dto.is_featured ?? existing.is_featured,
      show_on_homepage: dto.show_on_homepage ?? existing.show_on_homepage,
      thumbnail_image: dto.thumbnail_image ?? existing.thumbnail_image,
      banner_image: dto.banner_image ?? existing.banner_image,
      seo_title: dto.seo_title ?? existing.seo_title,
      seo_description: dto.seo_description ?? existing.seo_description,
      order: dto.order ?? existing.order,
    }});
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } as any });
    return { deleted: true, id };
  }

  private async ensureUniqueSlug(slug: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } as any });
    if (existing) throw new BadRequestException('slug must be unique');
  }
}
