import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UpdateHeroDto } from './dto/update-hero.dto';
import { HeroService } from './hero.service';

@Controller('hero')
export class HeroByIdController {
  constructor(private readonly heroService: HeroService) {}

  @Get(':heroId')
  findById(@Param('heroId') heroId: string) {
    return this.heroService.findById(heroId);
  }

  @Patch(':heroId')
  patchById(@Param('heroId') heroId: string, @Body() patchHeroDto: UpdateHeroDto) {
    return this.heroService.patchById(heroId, patchHeroDto);
  }
}