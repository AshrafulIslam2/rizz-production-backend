import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';

@Injectable()
export class BlogPostsService {
  constructor(private prisma: PrismaService) {}

  findAll(publishedOnly = false) {
    return this.prisma.blogPost.findMany({
      where: publishedOnly ? { is_published: true } : undefined,
      orderBy: { created_at: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) throw new NotFoundException(`Blog post "${slug}" not found`);
    return post;
  }

  async findById(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Blog post "${id}" not found`);
    return post;
  }

  create(dto: CreateBlogPostDto) {
    const { published_at, body, ...rest } = dto;
    return this.prisma.blogPost.create({
      data: {
        ...rest,
        body: body ?? [],
        published_at: published_at ? new Date(published_at) : undefined,
      },
    });
  }

  async update(id: string, dto: Partial<CreateBlogPostDto>) {
    await this.findById(id);
    const { published_at, body, ...rest } = dto;
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(body !== undefined ? { body } : {}),
        ...(published_at !== undefined ? { published_at: new Date(published_at) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.blogPost.delete({ where: { id } });
  }
}
