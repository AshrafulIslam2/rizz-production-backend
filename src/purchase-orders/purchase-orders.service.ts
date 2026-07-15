import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService) {}

  private async genPoNumber() {
    const count = await this.prisma.purchaseOrder.count();
    return `PO-${String(count + 1).padStart(4, '0')}`;
  }

  findAll(status?: string) {
    const where: any = status ? { status } : {};
    return this.prisma.purchaseOrder.findMany({ where, orderBy: { created_at: 'desc' }, include: { supplier: { select: { name: true } } } });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true } });
    if (!po) throw new NotFoundException('PO not found');
    return po;
  }

  async create(dto: any) {
    const po_number = await this.genPoNumber();
    return this.prisma.purchaseOrder.create({ data: { ...dto, po_number } });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.purchaseOrder.update({ where: { id }, data: dto });
  }

  async receive(id: string) {
    const po = await this.findOne(id);
    if (po.status === 'received') throw new Error('Already received');
    const items: any[] = Array.isArray(po.items) ? po.items : [];
    for (const item of items) {
      if (item.variant_id && item.qty > 0) {
        await this.inventory.recordMovement(item.variant_id, 'STOCK_IN', item.qty, po.po_number, `Purchase order ${po.po_number}`);
      }
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'received', received_at: new Date() } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.purchaseOrder.delete({ where: { id } });
  }
}
