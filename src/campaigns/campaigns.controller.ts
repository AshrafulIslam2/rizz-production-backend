import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CalculateCartDto } from './dto/calculate-cart.dto';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('active')
  findActive() {
    return this.campaignsService.findActive();
  }

  @Post('calculate-cart')
  calculateCart(@Body() dto: CalculateCartDto) {
    return this.campaignsService.calculateCart(dto);
  }

  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }
}
