import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildStockDashboard } from './stock-dashboard';

export type MoveType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'DAMAGE' | 'SALE' | 'RETURN';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMovement(variantId: string, type: MoveType, quantity: number, reference?: string, note?: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException(`Variant not found: ${variantId}`);
    const before_qty = variant.stock_qty;
    const delta = ['STOCK_OUT', 'DAMAGE', 'SALE'].includes(type) ? -Math.abs(quantity) : Math.abs(quantity);
    const after_qty = type === 'ADJUSTMENT' ? quantity : Math.max(0, before_qty + delta);
    const actualDelta = after_qty - before_qty;

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: { variant_id: variantId, type: type as any, quantity: Math.abs(actualDelta), before_qty, after_qty, reference, note },
      });
      await tx.productVariant.update({
        where: { id: variantId },
        data: { stock_qty: after_qty },
      });
      return movement;
    });
  }

  async getHistory(variantId?: string, type?: string, limit = 50) {
    const where: any = {};
    if (variantId) where.variant_id = variantId;
    if (type) where.type = type;
    return this.prisma.inventoryMovement.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        variant: { select: { sku: true, variant_name: true, attributes: true, product: { select: { name: true, slug: true } } } },
      },
    });
  }

  /**
   * Low stock, measured on what can actually still be sold.
   *
   * Filtering on stock_qty alone hides the worst case: a variant with 2 on the
   * shelf and both pairs already reserved is out of stock for the next
   * customer, but would never be flagged. The threshold is therefore applied
   * to (stock_qty - reserved_qty), which Prisma cannot express in a where
   * clause, so a slightly wider set is fetched and narrowed here.
   */
  async getLowStock(threshold = 5) {
    const variants = await this.prisma.productVariant.findMany({
      include: { product: { select: { name: true, slug: true, media: { where: { is_primary: true }, take: 1 } } } },
      orderBy: { stock_qty: 'asc' },
    });

    return variants
      .map((v) => {
        const reserved = (v as any).reserved_qty ?? 0;
        return { ...v, reserved_qty: reserved, available_qty: Math.max(0, v.stock_qty - reserved) };
      })
      .filter((v) => v.available_qty < threshold)
      .sort((a, b) => a.available_qty - b.available_qty);
  }

  async getDashboard(threshold = 10) {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, slug: true,
        variants: {
          orderBy: { created_at: 'asc' },
          select: {
            id: true, sku: true, variant_name: true, attributes: true,
            stock_qty: true, reserved_qty: true, price: true,
            sale_price: true, production_price: true,
          },
        },
      },
    });
    return buildStockDashboard(products, threshold);
  }

  async getStockSummary() {
    return (await this.getDashboard()).summary;
  }
}
