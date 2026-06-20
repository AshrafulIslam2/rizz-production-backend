import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SeoService } from './seo.service';

@Controller('seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    return this.seoService.get(key);
  }

  @Put(':key')
  upsert(@Param('key') key: string, @Body() data: Record<string, any>) {
    return this.seoService.upsert(key, data);
  }
}
