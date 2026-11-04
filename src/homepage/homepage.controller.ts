import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { HomepageService } from './homepage.service';
import { Public } from '../auth/public.decorator';

@Controller('homepage')
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  @Public()
  @Get(':section')
  getSection(@Param('section') section: string) {
    return this.homepageService.getSection(section);
  }

  @Put(':section')
  upsertSection(@Param('section') section: string, @Body() data: Record<string, any>) {
    return this.homepageService.upsertSection(section, data);
  }
}
