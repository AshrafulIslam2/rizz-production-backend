import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { CreateHeroDto } from './dto/create-hero.dto';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { HeroService } from './hero.service';

@Controller('pages/:pageId/hero')
export class HeroController {
  constructor(private readonly heroService: HeroService) {}

  @Get()
  findByPageId(@Param('pageId') pageId: string) {
    return this.heroService.findByPageId(pageId);
  }

  @Post()
  create(@Param('pageId') pageId: string, @Body() createHeroDto: CreateHeroDto) {
    return this.heroService.create(pageId, createHeroDto);
  }

  @Put()
  update(@Param('pageId') pageId: string, @Body() updateHeroDto: CreateHeroDto) {
    return this.heroService.update(pageId, updateHeroDto);
  }

  @Patch()
  patch(@Param('pageId') pageId: string, @Body() patchHeroDto: UpdateHeroDto) {
    return this.heroService.patch(pageId, patchHeroDto);
  }

  @Delete()
  remove(@Param('pageId') pageId: string) {
    return this.heroService.remove(pageId);
  }
}
