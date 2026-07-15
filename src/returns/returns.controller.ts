import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ReturnsService } from './returns.service';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly svc: ReturnsService) {}
  @Get()                  findAll(@Query('type') t?: string) { return this.svc.findAll(t); }
  @Get(':id')             findOne(@Param('id') id: string)   { return this.svc.findOne(id); }
  @Post()                 create(@Body() dto: any)            { return this.svc.create(dto); }
  @Post(':id/approve')    approve(@Param('id') id: string)   { return this.svc.approve(id); }
  @Put(':id')             update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id')          remove(@Param('id') id: string)    { return this.svc.remove(id); }
}
