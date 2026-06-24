import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { DeliverySettingsService } from './delivery-settings.service';

class UpdateDeliverySettingsDto {
  @IsOptional()
  @IsBoolean()
  free_delivery_global?: boolean;

  @IsOptional()
  @IsNumber()
  flat_fee?: number;
}

@Controller('delivery-settings')
export class DeliverySettingsController {
  constructor(private readonly deliverySettingsService: DeliverySettingsService) {}

  @Get()
  get() {
    return this.deliverySettingsService.get();
  }

  @Put()
  update(@Body() dto: UpdateDeliverySettingsDto) {
    return this.deliverySettingsService.update(dto);
  }
}
