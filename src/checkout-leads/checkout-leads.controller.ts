import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CreateCheckoutLeadDto } from './dto/create-checkout-lead.dto';
import { CheckoutLeadsService } from './checkout-leads.service';

class UpdateCheckoutLeadStatusDto {
  @IsString()
  status!: string;
}

@Controller('checkout-leads')
export class CheckoutLeadsController {
  constructor(private readonly checkoutLeadsService: CheckoutLeadsService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('source') source?: string) {
    return this.checkoutLeadsService.findAll(status, source);
  }

  @Post()
  upsert(@Body() dto: CreateCheckoutLeadDto) {
    return this.checkoutLeadsService.upsert(dto);
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCheckoutLeadStatusDto) {
    return this.checkoutLeadsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.checkoutLeadsService.remove(id);
  }
}
