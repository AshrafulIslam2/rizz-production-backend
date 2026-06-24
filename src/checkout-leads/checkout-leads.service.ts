import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutLeadDto } from './dto/create-checkout-lead.dto';

@Injectable()
export class CheckoutLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: CreateCheckoutLeadDto) {
    const source = dto.source ?? 'checkout';
    const existing = await this.prisma.checkoutLead.findFirst({
      where: { phone: dto.phone, status: 'new', source },
      orderBy: { created_at: 'desc' },
    });

    if (existing) {
      return this.prisma.checkoutLead.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          email: dto.email ?? existing.email,
          cart_total: dto.cart_total ?? existing.cart_total,
          company_name: dto.company_name ?? existing.company_name,
        },
      });
    }

    return this.prisma.checkoutLead.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        cart_total: dto.cart_total,
        source,
        company_name: dto.company_name,
      },
    });
  }

  findAll(status?: string, source?: string) {
    return this.prisma.checkoutLead.findMany({
      where: { ...(status ? { status } : {}), ...(source ? { source } : {}) },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    const existing = await this.prisma.checkoutLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Checkout lead ${id} not found`);
    return this.prisma.checkoutLead.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    const existing = await this.prisma.checkoutLead.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Checkout lead ${id} not found`);
    return this.prisma.checkoutLead.delete({ where: { id } });
  }

  /** Called when a real order is placed — the lead converted, no follow-up needed. */
  async markConvertedByPhone(phone: string) {
    await this.prisma.checkoutLead.updateMany({
      where: { phone, status: 'new' },
      data: { status: 'converted' },
    });
  }
}
