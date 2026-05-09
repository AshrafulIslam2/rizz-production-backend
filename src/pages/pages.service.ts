import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

type PageWithHero = Prisma.PageGetPayload<{ include: { hero: true } }>;
type PageTree = PageWithHero & { children: PageTree[] };

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PageTree[]> {
    const pages = await this.prisma.page.findMany({
      include: { hero: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return this.buildTree(pages);
  }

  async create(dto: CreatePageDto): Promise<PageTree> {
    const { children = [], ...data } = dto;

    const page = await this.prisma.page.create({
      data: {
        title: data.title,
        slug: data.slug,
        parentId: data.parentId ?? null,
        isVisible: data.isVisible ?? true,
        order: data.order ?? 0,
      },
    });

    if (children.length > 0) {
      await this.createChildren(page.id, children);
    }

    return this.findByIdOrThrow(page.id);
  }

  async update(id: string, dto: UpdatePageDto): Promise<PageTree> {
    const existing = await this.prisma.page.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Page with id ${id} not found`);
    }

    const { children, ...data } = dto;

    await this.prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug: data.slug,
        parentId: data.parentId === undefined ? undefined : data.parentId,
        isVisible: data.isVisible,
        order: data.order,
      },
    });

    if (children) {
      await this.upsertChildren(id, children);
    }

    return this.findByIdOrThrow(id);
  }

  async remove(id: string): Promise<{ deleted: true; id: string }> {
    await this.findByIdOrThrow(id);

    await this.prisma.page.delete({ where: { id } });

    return { deleted: true, id };
  }

  private async createChildren(parentId: string, children: CreatePageDto[]) {
    for (const child of children) {
      const { children: grandChildren = [], ...childData } = child;

      const createdChild = await this.prisma.page.create({
        data: {
          title: childData.title,
          slug: childData.slug,
          parentId,
          isVisible: childData.isVisible ?? true,
          order: childData.order ?? 0,
        },
      });

      if (grandChildren.length > 0) {
        await this.createChildren(createdChild.id, grandChildren);
      }
    }
  }

  private async upsertChildren(parentId: string, children: UpdatePageDto[]) {
    for (const child of children) {
      const { id: childId, children: grandChildren, ...childData } = child;

      if (childId) {
        await this.prisma.page.update({
          where: { id: childId },
          data: {
            title: childData.title,
            slug: childData.slug,
            parentId,
            isVisible: childData.isVisible,
            order: childData.order,
          },
        });

        if (grandChildren?.length) {
          await this.upsertChildren(childId, grandChildren);
        }

        continue;
      }

      const createdChild = await this.prisma.page.create({
        data: {
          title: childData.title ?? '',
          slug: childData.slug ?? '',
          parentId,
          isVisible: childData.isVisible ?? true,
          order: childData.order ?? 0,
        },
      });

      if (grandChildren?.length) {
        await this.upsertChildren(createdChild.id, grandChildren);
      }
    }
  }

  private async findByIdOrThrow(id: string): Promise<PageTree> {
    const page = await this.prisma.page.findUnique({ where: { id }, include: { hero: true } });

    if (!page) {
      throw new NotFoundException(`Page with id ${id} not found`);
    }

    const pages = await this.prisma.page.findMany({
      include: { hero: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return this.buildTree(pages).find((item) => item.id === id) ?? { ...page, children: [] };
  }

  private buildTree(pages: PageWithHero[]): PageTree[] {
    const map = new Map<string, PageTree>();
    const roots: PageTree[] = [];

    for (const page of pages) {
      map.set(page.id, { ...page, children: [] });
    }

    for (const page of pages) {
      const node = map.get(page.id);

      if (!node) {
        continue;
      }

      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}