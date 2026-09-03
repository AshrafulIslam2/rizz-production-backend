import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { InventoryService, MoveType } from './inventory.service';
import { StockReconcileService } from './stock-reconcile.service';

class MoveDto {
  @IsString() variant_id!: string;
  @IsString() type!: MoveType;
  @IsInt() quantity!: number;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly svc: InventoryService,
    private readonly reconcile: StockReconcileService,
  ) {}

  /**
   * What the one-time stock repair WOULD do. Writes nothing.
   *
   * Every order used to decrement stock the moment it was placed, so orders
   * that were cancelled, faked or never confirmed have eaten inventory that
   * was never given back. This shows exactly how much, per variant.
   */
  @Get('reconcile/audit')
  auditStock() {
    return this.reconcile.audit();
  }

  /** Apply that repair. Refuses to run a second time unless forced. */
  @Post('reconcile/apply')
  applyStockReconcile(@Body() dto: any) {
    return this.reconcile.apply({ force: dto?.force === true, actor: dto?.actor });
  }

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
