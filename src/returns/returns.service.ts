import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  private async genRefNumber() {
    const count = await this.prisma.returnExchange.count();
    return `RET-${String(count + 1).padStart(5, '0')}`;
  }

  findAll(type?: string) {
    const where: any = type ? { type } : {};
    return this.prisma.returnExchange.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.returnExchange.findUnique({ where: { id } });
  }

  async create(dto: any) {
    const ref_number = await this.genRefNumber();
    return this.prisma.returnExchange.create({ data: { ...dto, ref_number } });
  }

  async approve(id: string) {
    const ret = await this.prisma.returnExchange.findUnique({ where: { id } });
    if (!ret) throw new Error('Not found');
    const items: any[] = Array.isArray(ret.items) ? ret.items : [];
    for (const item of items) {
      if (item.variant_id && item.qty > 0) {
        await this.inventory.recordMovement(item.variant_id, 'RETURN', item.qty, ret.ref_number, `Return/Exchange ${ret.type}`);
      }
    }
    return this.prisma.returnExchange.update({ where: { id }, data: { status: 'approved' } });
  }

  async update(id: string, dto: any) {
    return this.prisma.returnExchange.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.returnExchange.delete({ where: { id } });
  }
}
