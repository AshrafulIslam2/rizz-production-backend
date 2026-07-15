import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
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

      for (const item of dto.items ?? []) {
        await this.decrementVariantStock(tx, item);
      }

      return created;
    });

    if (dto.campaign_ids && dto.campaign_ids.length > 0) {
      await this.campaignsService.registerUsage(dto.campaign_ids);
    }

    await this.checkoutLeadsService.markConvertedByPhone(dto.customer_phone);

    return order;
  }

  private async decrementVariantStock(tx: Prisma.TransactionClient, item: any) {
    const quantity = Number(item?.quantity) || 0;
    if (!item?.slug || quantity <= 0) return;

    const product = await tx.product.findUnique({
      where: { slug: item.slug },
      include: { variants: true },
    });
    if (!product || product.variants.length === 0) return;

    const variant =
      product.variants.find(
        (v) =>
          String((v.attributes as any)?.size ?? '') === String(item.size ?? '') &&
          String((v.attributes as any)?.color ?? '') === String(item.color ?? ''),
      ) ?? (product.variants.length === 1 ? product.variants[0] : undefined);

    if (!variant) return;

    const nextStock = Math.max(0, variant.stock_qty - quantity);
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { stock_qty: nextStock },
    });
  }

  async getProfitStats() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'delivered' },
    });

    // Build variant lookup: slug+size+color → production_price
    const products = await this.prisma.product.findMany({
      select: {
        slug: true,
        variants: { select: { attributes: true, production_price: true, price: true } },
      },
    });

    const variantMap = new Map<string, number>();
    for (const product of products as any[]) {
      for (const v of product.variants ?? []) {
        const size = String((v.attributes as any)?.size ?? '');
        const color = String((v.attributes as any)?.color ?? '');
        const key = `${product.slug}|${size}|${color}`;
        if (v.production_price != null) {
          variantMap.set(key, v.production_price);
        }
      }
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let itemsWithCost = 0;

    for (const order of orders) {
      totalRevenue += order.total ?? 0;
      const items: any[] = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const qty = Number(item?.quantity) || 1;
        const key = `${item?.slug}|${String(item?.size ?? '')}|${String(item?.color ?? '')}`;
        const prodCost = variantMap.get(key);
        if (prodCost != null) {
          totalCost += prodCost * qty;
          itemsWithCost += qty;
        }
      }
    }

    const totalProfit = totalRevenue - totalCost;
    return {
      totalRevenue,
      totalCost,
      totalProfit,
      deliveredOrders: orders.length,
      itemsWithCost,
    };
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
