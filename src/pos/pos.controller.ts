import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PosService } from './pos.service';

@Controller('pos')
export class PosController {
  constructor(private readonly svc: PosService) {}
  @Get()              findAll(@Query('status') s?: string, @Query('limit') l?: number) { return this.svc.findAll(s, l); }
  @Get('summary')     getSummary(@Query('from') from?: string, @Query('to') to?: string) { return this.svc.getSummary(from, to); }
  // Must stay ABOVE ':id' — Nest matches routes in declaration order, so a
  // literal path declared after ':id' would be swallowed by findOne().
  @Get('shop-stats')  getShopStats(@Query('from') from?: string, @Query('to') to?: string) { return this.svc.getShopStats(from, to); }
  @Get(':id')         findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Post()             create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id')         update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id')      remove(@Param('id') id: string) { return this.svc.remove(id); }
}
