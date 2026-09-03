import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.ordersService.findAll(status, includeArchived === 'true');
  }

  @Get('stats/profit')
  getProfitStats() {
    return this.ordersService.getProfitStats();
  }

  /** Order counts and the financial buckets, for the dashboard. */
  @Get('stats/summary')
  getOrderSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.ordersService.getOrderSummary(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /** Numbers that keep producing orders the shop never gets paid for. */
  @Get('fraud/customers')
  getFraudCustomers(@Query('minScore') minScore?: string) {
    return this.ordersService.getFraudCustomers(
      minScore === undefined ? undefined : Number(minScore),
    );
  }

  /** Fraud check: what this phone number has done before. */
  @Get('customer-history/:phone')
  getCustomerHistory(@Param('phone') phone: string, @Query('exclude') exclude?: string) {
    return this.ordersService.getCustomerHistory(phone, exclude);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.ordersService.getHistory(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.updateStatus(id, dto?.status, dto);
  }

  // ── Lifecycle actions ──
  // Each is its own endpoint rather than a generic PATCH so the ones that
  // demand a reason cannot be called without one.

  @Post(':id/verify')
  verify(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.verifyOrder(id, dto);
  }

  @Post(':id/mark-fake')
  markFake(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.markFake(id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.cancelOrder(id, dto);
  }

  @Post(':id/payment')
  recordPayment(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.recordPayment(id, dto);
  }

  @Patch(':id/fulfillment')
  updateFulfillment(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.updateFulfillment(id, dto);
  }

  @Patch(':id/return')
  updateReturn(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.updateReturn(id, dto);
  }

  @Patch(':id/internal-note')
  setInternalNote(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.setInternalNote(id, dto);
  }

  @Patch(':id/archive')
  setArchived(@Param('id') id: string, @Body() dto: any) {
    return this.ordersService.setArchived(id, dto?.archived !== false, dto?.changed_by);
  }

  /**
   * Permanent deletion. Refuses anything that is not a Test Order — a fake
   * order is evidence, not rubbish.
   */
  @Delete(':id')
  hardDelete(@Param('id') id: string, @Query('confirm') confirm?: string) {
    return this.ordersService.hardDelete(id, confirm);
  }
}
