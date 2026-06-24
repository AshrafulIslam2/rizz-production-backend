import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { CheckoutLeadsService } from '../checkout-leads/checkout-leads.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
    private readonly checkoutLeadsService: CheckoutLeadsService,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    const num = String(count + 1).padStart(3, '0');
    return `ORZ-${num}`;
  }

  async findAll(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.prisma.order.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto) {
    const order_number = await this.generateOrderNumber();
    const order = await this.prisma.order.create({
      data: {
        order_number,
        customer_name: dto.customer_name,
        customer_phone: dto.customer_phone,
        customer_email: dto.customer_email,
        division: dto.division,
        district: dto.district,
        area: dto.area,
        address: dto.address,
        items: dto.items,
        subtotal: dto.subtotal,
        shipping_fee: dto.shipping_fee ?? 0,
        discount_amount: dto.discount_amount ?? 0,
        promo_code: dto.promo_code,
        campaign_ids: dto.campaign_ids ?? [],
        free_gifts: dto.free_gifts ?? undefined,
        total: dto.total,
        payment_method: dto.payment_method ?? 'COD',
        notes: dto.notes,
      },
    });

    if (dto.campaign_ids && dto.campaign_ids.length > 0) {
      await this.campaignsService.registerUsage(dto.campaign_ids);
    }

    await this.checkoutLeadsService.markConvertedByPhone(dto.customer_phone);

    return order;
  }

  async updateStatus(id: string, status: string) {
    const order = await this.prisma.order.findUnique({ where: { id } as any });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.prisma.order.update({
      where: { id } as any,
      data: { status } as any,
    });
  }
}
