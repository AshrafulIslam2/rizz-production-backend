import { Body, Controller, Get, Put } from '@nestjs/common';
import { VariantOptionsService, VariantOptions } from './variant-options.service';

@Controller('variant-options')
export class VariantOptionsController {
  constructor(private readonly svc: VariantOptionsService) {}

  /** Saved list only — what the settings page edits. */
  @Get()
  get() {
    return this.svc.get();
  }

  /** Saved list merged with values already used by existing variants. */
  @Get('all')
  getAll() {
    return this.svc.getWithUsed();
  }

  @Put()
  update(@Body() body: Partial<VariantOptions>) {
    return this.svc.update(body ?? {});
  }
}
