import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly svc: PurchaseOrdersService) {}
  @Get()              findAll(@Query('status') s?: string) { return this.svc.findAll(s); }
  @Get(':id')         findOne(@Param('id') id: string)     { return this.svc.findOne(id); }
  @Post()             create(@Body() dto: any)              { return this.svc.create(dto); }
  @Patch(':id')       update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Post(':id/receive') receive(@Param('id') id: string)    { return this.svc.receive(id); }
  @Delete(':id')      remove(@Param('id') id: string)      { return this.svc.remove(id); }
}
