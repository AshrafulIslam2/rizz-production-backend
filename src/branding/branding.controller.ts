import { Body, Controller, Get, Put } from '@nestjs/common';
import { BrandingService } from './branding.service';
import { Public } from '../auth/public.decorator';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Public()
  @Get()
  get() {
    return this.brandingService.get();
  }

  @Put()
  upsert(@Body() data: Record<string, any>) {
    return this.brandingService.upsert(data);
  }
}
