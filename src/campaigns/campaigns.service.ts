import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CalculateCartDto } from './dto/calculate-cart.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { created_at: 'desc' } });
  }

  async findActive() {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        is_active: true,
        requires_code: false,
        AND: [
          { OR: [{ start_date: null }, { start_date: { lte: now } }] },
          { OR: [{ end_date: null }, { end_date: { gte: now } }] },
        ],
      },
      orderBy: { created_at: 'desc' },
    });
    return campaigns;
  }

  async create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        type: dto.type ?? 'promotion',
        code: dto.code || null,
        requires_code: dto.requires_code ?? false,
        discount_type: dto.discount_type || null,
        discount_value: dto.discount_value,
        buy_qty: dto.buy_qty,
        get_qty: dto.get_qty,
        free_shipping: dto.free_shipping ?? false,
        free_gift_product_id: dto.free_gift_product_id || null,
        usage_limit: dto.usage_limit,
        product_ids: dto.product_ids ?? [],
        start_date: dto.start_date ? new Date(dto.start_date) : null,
        end_date: dto.end_date ? new Date(dto.end_date) : null,
        is_active: dto.is_active ?? true,
        image_url: dto.image_url,
        headline: dto.headline,
        body: dto.body,
      },
    });
  }

  async update(id: string, dto: Partial<CreateCampaignDto>) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);

    const data: any = { ...dto };
    if (dto.code !== undefined) data.code = dto.code || null;
    if (dto.discount_type !== undefined) data.discount_type = dto.discount_type || null;
    if (dto.free_gift_product_id !== undefined) data.free_gift_product_id = dto.free_gift_product_id || null;
    if (dto.start_date) data.start_date = new Date(dto.start_date);
    if (dto.end_date) data.end_date = new Date(dto.end_date);

    return this.prisma.campaign.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);
    return this.prisma.campaign.delete({ where: { id } });
  }

  private isCampaignLive(c: { is_active: boolean; start_date: Date | null; end_date: Date | null }, now: Date) {
    if (!c.is_active) return false;
    if (c.start_date && c.start_date > now) return false;
    if (c.end_date && c.end_date < now) return false;
    return true;
  }

  private matchesProduct(c: { product_ids: string[] }, productId: string) {
    return c.product_ids.length === 0 || c.product_ids.includes(productId);
  }

  private computeLineDiscount(
    campaign: { discount_type: string | null; discount_value: number | null; buy_qty: number | null; get_qty: number | null },
    price: number,
    quantity: number,
  ): number {
    if (!campaign.discount_type) return 0;
    const lineTotal = price * quantity;

    if (campaign.discount_type === 'PERCENT' && campaign.discount_value) {
      return Math.min(lineTotal, (lineTotal * campaign.discount_value) / 100);
    }
    if (campaign.discount_type === 'FIXED' && campaign.discount_value) {
      return Math.min(lineTotal, campaign.discount_value * quantity);
    }
    if (campaign.discount_type === 'BOGO' && campaign.buy_qty && campaign.get_qty) {
      const groupSize = campaign.buy_qty + campaign.get_qty;
      const freeUnits = Math.floor(quantity / groupSize) * campaign.get_qty;
      return Math.min(lineTotal, freeUnits * price);
    }
    return 0;
  }

  async calculateCart(dto: CalculateCartDto) {
    const now = new Date();
    const subtotal = dto.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const baseShipping = dto.shipping_fee ?? 0;

    const autoCampaigns = await this.prisma.campaign.findMany({
      where: { is_active: true, requires_code: false },
      orderBy: { created_at: 'desc' },
    });
    const liveAuto = autoCampaigns.filter((c) => this.isCampaignLive(c, now));

    let codeCampaign: (typeof liveAuto)[number] | null = null;
    let codeMessage: string | null = null;
    if (dto.code && dto.code.trim()) {
      const found = await this.prisma.campaign.findFirst({
        where: { code: { equals: dto.code.trim(), mode: 'insensitive' }, requires_code: true },
      });
      if (!found) {
        codeMessage = 'Invalid promo code.';
      } else if (!this.isCampaignLive(found, now)) {
        codeMessage = 'This promo code has expired.';
      } else if (found.usage_limit != null && found.used_count >= found.usage_limit) {
        codeMessage = 'This promo code has reached its usage limit.';
      } else {
        codeCampaign = found;
      }
    }

    let discountAmount = 0;
    let freeShipping = false;
    const giftProductIds = new Set<string>();
    const appliedCampaigns: { id: string; name: string; code: string | null }[] = [];

    for (const item of dto.items) {
      const matchingAuto = liveAuto.filter((c) => this.matchesProduct(c, item.product_id));
      const pricingAuto = matchingAuto.find((c) => c.discount_type);
      if (pricingAuto) {
        discountAmount += this.computeLineDiscount(pricingAuto, item.price, item.quantity);
        if (!appliedCampaigns.some((a) => a.id === pricingAuto.id)) {
          appliedCampaigns.push({ id: pricingAuto.id, name: pricingAuto.name, code: null });
        }
      }
      matchingAuto.forEach((c) => {
        if (c.free_shipping) freeShipping = true;
        if (c.free_gift_product_id) giftProductIds.add(c.free_gift_product_id);
      });

      if (codeCampaign && this.matchesProduct(codeCampaign, item.product_id)) {
        discountAmount += this.computeLineDiscount(codeCampaign, item.price, item.quantity);
        if (codeCampaign.free_shipping) freeShipping = true;
        if (codeCampaign.free_gift_product_id) giftProductIds.add(codeCampaign.free_gift_product_id);
        if (!appliedCampaigns.some((a) => a.id === codeCampaign!.id)) {
          appliedCampaigns.push({ id: codeCampaign.id, name: codeCampaign.name, code: codeCampaign.code });
        }
      }
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const shippingFee = freeShipping ? 0 : baseShipping;

    let freeGifts: { product_id: string; name: string; image: string | null; price: number }[] = [];
    if (giftProductIds.size > 0) {
      const gifts = await this.prisma.product.findMany({
        where: { id: { in: Array.from(giftProductIds) } },
        include: { media: { orderBy: { is_primary: 'desc' }, take: 1 } },
      });
      freeGifts = gifts.map((g) => ({
        product_id: g.id,
        name: g.name,
        image: g.media[0]?.media_url ?? null,
        price: g.price ?? 0,
      }));
    }

    return {
      subtotal,
      discount_amount: Math.round(discountAmount * 100) / 100,
      shipping_fee: shippingFee,
      free_shipping: freeShipping,
      free_gifts: freeGifts,
      total: Math.max(0, subtotal - discountAmount + shippingFee),
      applied_campaigns: appliedCampaigns,
      code_valid: dto.code ? !!codeCampaign : null,
      code_message: codeMessage,
    };
  }

  async registerUsage(campaignIds: string[]) {
    if (!campaignIds.length) return;
    await this.prisma.campaign.updateMany({
      where: { id: { in: campaignIds } },
      data: { used_count: { increment: 1 } },
    });
  }
}
