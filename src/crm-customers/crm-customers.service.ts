import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(search?: string) {
    const where: any = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }, { email: { contains: search, mode: 'insensitive' } }] }
      : {};
    return this.prisma.crmCustomer.findMany({ where, orderBy: { total_spend: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.crmCustomer.findUnique({ where: { id } });
  }

  async upsertByPhone(phone: string, data: { name?: string; email?: string; address?: string; spend?: number }) {
    const existing = await this.prisma.crmCustomer.findUnique({ where: { phone } });
    if (existing) {
      return this.prisma.crmCustomer.update({
        where: { phone },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.email && { email: data.email }),
          ...(data.address && { address: data.address }),
          ...(data.spend ? { total_spend: { increment: data.spend }, total_orders: { increment: 1 } } : {}),
        },
      });
    }
    return this.prisma.crmCustomer.create({ data: { phone, name: data.name || phone, email: data.email, address: data.address, total_spend: data.spend || 0, total_orders: data.spend ? 1 : 0 } });
  }

  create(dto: any) { return this.prisma.crmCustomer.create({ data: dto }); }

  update(id: string, dto: any) { return this.prisma.crmCustomer.update({ where: { id }, data: dto }); }

  remove(id: string) { return this.prisma.crmCustomer.delete({ where: { id } }); }
}
