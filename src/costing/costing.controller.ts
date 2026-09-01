import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CostingService } from './costing.service';

@Controller('costing')
export class CostingController {
  constructor(private readonly svc: CostingService) {}

  // ── Dynamic cost fields ──
  // Literal paths are declared before ':id' routes so Nest does not match
  // them as an id.
  @Get('fields')
  listFields(@Query('includeArchived') includeArchived?: string) {
    return this.svc.listFields(includeArchived === 'true');
  }

  @Post('fields')
  createField(@Body() dto: any) {
    return this.svc.createField(dto);
  }

  @Patch('fields/reorder')
  reorderFields(@Body() dto: any) {
    return this.svc.reorderFields(dto?.ids ?? []);
  }

  @Patch('fields/:id')
  updateField(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateField(id, dto);
  }

  @Delete('fields/:id')
  archiveField(@Param('id') id: string) {
    return this.svc.archiveField(id);
  }

  // ── Factory cost settings (shop-wide monthly bills) ──
  @Get('factory-settings')
  getFactorySettings() {
    return this.svc.getFactorySettings();
  }

  @Put('factory-settings')
  updateFactorySettings(@Body() dto: any) {
    return this.svc.updateFactorySettings(dto);
  }

  /** What a given standard capacity would cost per dozen and per pair. */
  @Get('factory-allocation')
  previewFactoryAllocation(@Query('pairs') pairs?: string) {
    return this.svc.previewFactoryAllocation(pairs);
  }

  // ── Retail cost settings ──
  @Get('retail-settings')
  getRetailSettings() {
    return this.svc.getRetailSettings();
  }

  @Put('retail-settings')
  updateRetailSettings(@Body() dto: any) {
    return this.svc.updateRetailSettings(dto);
  }

  // ── Live preview (calculates, saves nothing) ──
  @Post('preview')
  preview(@Body() dto: any) {
    return this.svc.preview(dto);
  }

  // ── Product costing records ──
  @Get('products')
  listCostings() {
    return this.svc.listCostings();
  }

  @Get('products/:id')
  getCosting(@Param('id') id: string) {
    return this.svc.getCosting(id);
  }

  @Post('products')
  createCosting(@Body() dto: any) {
    return this.svc.createCosting(dto);
  }

  @Patch('products/:id')
  updateCosting(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateCosting(id, dto);
  }

  @Delete('products/:id')
  removeCosting(@Param('id') id: string) {
    return this.svc.removeCosting(id);
  }
}
