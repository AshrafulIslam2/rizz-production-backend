import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { BlogPostsService } from './blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { Public } from '../auth/public.decorator';
import { isAdminRequest } from '../auth/admin-key.guard';

@Controller('blog-posts')
export class BlogPostsController {
  constructor(private readonly service: BlogPostsService) {}

  @Public()
  @Get()
  findAll(@Req() req: unknown, @Query('published') published?: string) {
    // Drafts are admin-only; the public always gets published posts.
    return this.service.findAll(published === 'true' || !isAdminRequest(req));
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Req() req: unknown, @Param('slug') slug: string) {
    const post = await this.service.findBySlug(slug);
    if (!post.is_published && !isAdminRequest(req)) {
      throw new NotFoundException(`Blog post "${slug}" not found`);
    }
    return post;
  }

  @Post()
  create(@Body() dto: CreateBlogPostDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateBlogPostDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
