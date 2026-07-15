import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() { return this.prisma.supplier.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { purchase_orders: true } } } }); }

  async findOne(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id }, include: { purchase_orders: { orderBy: { created_at: 'desc' }, take: 20 } } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  create(data: any) { return this.prisma.supplier.create({ data }); }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.delete({ where: { id } });
  }
}
