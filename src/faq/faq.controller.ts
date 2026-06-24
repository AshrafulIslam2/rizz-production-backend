import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqService } from './faq.service';

@Controller('pages/:pageId/faqs')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  findByPageId(@Param('pageId') pageId: string) {
    return this.faqService.findByPageId(pageId);
  }

  @Get('schema')
  findSchemaByPageId(@Param('pageId') pageId: string) {
    return this.faqService.findSchemaByPageId(pageId);
  }

  @Get(':faqId')
  findOne(@Param('pageId') pageId: string, @Param('faqId') faqId: string) {
    return this.faqService.findOne(pageId, faqId);
  }

  @Post()
  create(@Param('pageId') pageId: string, @Body() createFaqDto: CreateFaqDto) {
    return this.faqService.create(pageId, createFaqDto);
  }

  @Put(':faqId')
  update(
    @Param('pageId') pageId: string,
    @Param('faqId') faqId: string,
    @Body() updateFaqDto: CreateFaqDto,
  ) {
    return this.faqService.update(pageId, faqId, updateFaqDto);
  }

  @Patch(':faqId')
  patch(
    @Param('pageId') pageId: string,
    @Param('faqId') faqId: string,
    @Body() patchFaqDto: UpdateFaqDto,
  ) {
    return this.faqService.patch(pageId, faqId, patchFaqDto);
  }

  @Delete(':faqId')
  remove(@Param('pageId') pageId: string, @Param('faqId') faqId: string) {
    return this.faqService.remove(pageId, faqId);
  }
}
