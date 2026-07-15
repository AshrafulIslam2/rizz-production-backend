import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MoveType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'DAMAGE' | 'SALE' | 'RETURN';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMovement(variantId: string, type: MoveType, quantity: number, reference?: string, note?: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found');
    const before_qty = variant.stock_qty;
    const delta = ['STOCK_OUT', 'DAMAGE', 'SALE'].includes(type) ? -Math.abs(quantity) : Math.abs(quantity);
    const after_qty = type === 'ADJUSTMENT' ? quantity : Math.max(0, before_qty + delta);
    const actualDelta = after_qty - before_qty;

    const [movement] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.create({
        data: { variant_id: variantId, type: type as any, quantity: Math.abs(actualDelta), before_qty, after_qty, reference, note },
      }),
      this.prisma.productVariant.update({
        where: { id: variantId },
        data: { stock_qty: after_qty },
      }),
    ]);
    return movement;
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

  async getLowStock(threshold = 5) {
    const variants = await this.prisma.productVariant.findMany({
      where: { stock_qty: { lt: threshold } },
      include: { product: { select: { name: true, slug: true, media: { where: { is_primary: true }, take: 1 } } } },
      orderBy: { stock_qty: 'asc' },
    });
    return variants;
  }

  async getStockSummary() {
    const variants = await this.prisma.productVariant.findMany({
      select: { stock_qty: true, price: true, production_price: true },
    });
    const totalQty = variants.reduce((s, v) => s + v.stock_qty, 0);
    const totalValue = variants.reduce((s, v) => s + v.price * v.stock_qty, 0);
    const totalCost = variants.reduce((s, v) => s + (v.production_price ?? 0) * v.stock_qty, 0);
    const outOfStock = variants.filter((v) => v.stock_qty === 0).length;
    return { totalQty, totalValue, totalCost, outOfStock, totalVariants: variants.length };
  }
}
