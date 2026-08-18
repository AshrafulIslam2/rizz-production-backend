import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { buildShopStats } from './shop-stats';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  private async genTxNumber() {
    const count = await this.prisma.posTransaction.count();
    return `TX-${String(count + 1).padStart(6, '0')}`;
  }

  findAll(status?: string, limit = 50) {
    const where: any = {};
    if (status) where.status = status;
    return this.prisma.posTransaction.findMany({ where, orderBy: { created_at: 'desc' }, take: Number(limit) });
  }

  async findOne(id: string) {
    return this.prisma.posTransaction.findUnique({ where: { id } });
  }

  async create(dto: any) {
    const tx_number = await this.genTxNumber();
    const items: any[] = Array.isArray(dto.items) ? dto.items : [];

    // Stock validation before creating transaction
    if (dto.status !== 'draft') {
      for (const item of items) {
        if (!item.variant_id || item.qty <= 0) continue;
        const variant = await this.prisma.productVariant.findUnique({ where: { id: item.variant_id } });
        if (!variant) throw new BadRequestException(`Variant not found: ${item.variant_id}`);
        if (variant.stock_qty < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for "${item.name}". Available: ${variant.stock_qty}, requested: ${item.qty}`
          );
        }
      }
    }

    // Only pass columns that actually exist on PosTransaction. Spreading the
    // raw request body made Prisma reject the whole call with a 500 as soon as
    // the client sent any extra field (e.g. `sale_discount`, which the POS UI
    // computes but this table has no column for — it stays derivable from the
    // per-item original_price/price already saved in `items`).
    const tx = await this.prisma.posTransaction.create({
      data: {
        tx_number,
        customer_name: dto.customer_name ?? null,
        customer_phone: dto.customer_phone ?? null,
        items,
        subtotal: Number(dto.subtotal) || 0,
        discount_amount: Number(dto.discount_amount) || 0,
        discount_type: dto.discount_type ?? 'flat',
        total: Number(dto.total) || 0,
        payment_cash: Number(dto.payment_cash) || 0,
        payment_card: Number(dto.payment_card) || 0,
        payment_mobile: Number(dto.payment_mobile) || 0,
        status: dto.status ?? 'completed',
        note: dto.note ?? null,
      },
    });
    if (dto.status !== 'draft') {
      for (const item of items) {
        if (item.variant_id && item.qty > 0) {
          try {
            await this.inventory.recordMovement(item.variant_id, 'SALE', item.qty, tx_number, 'POS sale');
            this.logger.log(`Stock deducted: variant=${item.variant_id} qty=${item.qty} tx=${tx_number}`);
          } catch (err) {
            this.logger.error(`Failed to deduct stock for variant ${item.variant_id}: ${(err as any)?.message ?? err}`);
            throw err;
          }
        }
      }
    }
    return tx;
  }

  async update(id: string, dto: any) {
    return this.prisma.posTransaction.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.posTransaction.delete({ where: { id } });
  }

  /** Counter-sales analytics: volume, revenue and profit for the POS terminal. */
  async getShopStats(from?: string, to?: string) {
    const where: any = { status: { not: 'draft' } };
    if (from || to) {
      where.created_at = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        where.created_at.gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }

    const [txs, variants] = await Promise.all([
      this.prisma.posTransaction.findMany({ where, orderBy: { created_at: 'asc' } }),
      this.prisma.productVariant.findMany({ select: { id: true, production_price: true } }),
    ]);

    const variantCost = new Map<string, number | null>();
    for (const v of variants) variantCost.set(v.id, v.production_price ?? null);

    return buildShopStats(txs as any, variantCost);
  }

  async getSummary(from?: string, to?: string) {
    const where: any = { status: 'completed' };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }
    const txs = await this.prisma.posTransaction.findMany({ where });
    const total = txs.reduce((s, t) => s + t.total, 0);
    const count = txs.length;
    const cash = txs.reduce((s, t) => s + t.payment_cash, 0);
    const card = txs.reduce((s, t) => s + t.payment_card, 0);
    const mobile = txs.reduce((s, t) => s + t.payment_mobile, 0);
    return { total, count, cash, card, mobile };
  }
}
