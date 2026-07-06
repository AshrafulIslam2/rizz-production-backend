import { Body, Controller, Get, Put } from '@nestjs/common';
import { AboutService } from './about.service';

@Controller('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Get()
  get() {
    return this.aboutService.get();
  }

  @Put()
  upsert(@Body() data: Record<string, any>) {
    return this.aboutService.upsert(data);
  }
}
