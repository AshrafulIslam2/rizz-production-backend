import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { InventoryService, MoveType } from './inventory.service';

class MoveDto {
  @IsString() variant_id!: string;
  @IsString() type!: MoveType;
  @IsInt() quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Post('move')
  move(@Body() dto: MoveDto) {
    return this.svc.recordMovement(dto.variant_id, dto.type, dto.quantity, dto.reference, dto.note);
  }

  @Get('history')
  history(@Query('variantId') variantId?: string, @Query('type') type?: string, @Query('limit') limit?: string) {
    return this.svc.getHistory(variantId, type, limit ? Number(limit) : 50);
  }

  @Get('low-stock')
  lowStock(@Query('threshold') threshold?: string) {
    return this.svc.getLowStock(threshold ? Number(threshold) : 5);
  }

  @Get('summary')
  summary() {
    return this.svc.getStockSummary();
  }
}
