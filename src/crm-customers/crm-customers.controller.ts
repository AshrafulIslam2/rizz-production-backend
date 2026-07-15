import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CrmCustomersService } from './crm-customers.service';

@Controller('crm-customers')
export class CrmCustomersController {
  constructor(private readonly svc: CrmCustomersService) {}
  @Get()         findAll(@Query('search') s?: string) { return this.svc.findAll(s); }
  @Get(':id')    findOne(@Param('id') id: string)     { return this.svc.findOne(id); }
  @Post()        create(@Body() dto: any)              { return this.svc.create(dto); }
  @Put(':id')    update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string)      { return this.svc.remove(id); }
}
