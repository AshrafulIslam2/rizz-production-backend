import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PosService {
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
    const tx = await this.prisma.posTransaction.create({ data: { ...dto, tx_number } });
    if (dto.status !== 'draft') {
      for (const item of items) {
        if (item.variant_id && item.qty > 0) {
          await this.inventory.recordMovement(item.variant_id, 'SALE', item.qty, tx_number, 'POS sale');
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
