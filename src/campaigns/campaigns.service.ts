import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliverySettingsService } from '../delivery-settings/delivery-settings.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CalculateCartDto } from './dto/calculate-cart.dto';
import { assertCampaignWindow, parseCampaignDate } from './campaign-dates';

const DATE_FIX_MARKER = 'campaign_dates_dhaka_fix_v1';
const HOUR = 60 * 60 * 1000;

@Injectable()
export class CampaignsService implements OnModuleInit {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliverySettings: DeliverySettingsService,
  ) {}

  /**
   * One-time repair of campaigns saved before dates were read as Dhaka time.
   *
   * The old form sent a bare date, stored as midnight UTC (6 AM Dhaka) — so a
   * campaign "ending on the 13th" actually ended at 6 AM on the 13th. Those
   * exact-midnight-UTC values are moved to what the admin meant: start of day
   * and end of day in Dhaka. Runs once, guarded by a marker in Setting.
   */
  async onModuleInit() {
    try {
      const done = await this.prisma.setting.findUnique({ where: { key: DATE_FIX_MARKER } });
      if (done) return;
      const isUtcMidnight = (d: Date | null) =>
        !!d && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;

      const rows = await this.prisma.campaign.findMany({ select: { id: true, start_date: true, end_date: true } });
      let fixed = 0;
      for (const c of rows) {
        const data: { start_date?: Date; end_date?: Date } = {};
        // 2026-11-13T00:00Z (meant: 13 Nov) -> 2026-11-13T00:00+06:00
        if (isUtcMidnight(c.start_date)) data.start_date = new Date(c.start_date!.getTime() - 6 * HOUR);
        // 2026-11-13T00:00Z (meant: 13 Nov) -> 2026-11-13T23:59:59.999+06:00
        if (isUtcMidnight(c.end_date)) data.end_date = new Date(c.end_date!.getTime() + 18 * HOUR - 1);
        if (data.start_date || data.end_date) {
          await this.prisma.campaign.update({ where: { id: c.id }, data });
          fixed++;
        }
      }
      await this.prisma.setting.create({
        data: { key: DATE_FIX_MARKER, value: { fixed, at: new Date().toISOString() } as any },
      });
      if (fixed) this.logger.log(`Moved ${fixed} campaign date(s) to Dhaka start/end of day.`);
    } catch (e) {
      this.logger.error(`Campaign date repair skipped: ${(e as Error).message}`);
    }
  }

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
    const start = parseCampaignDate(dto.start_date, 'start') ?? null;
    const end = parseCampaignDate(dto.end_date, 'end') ?? null;
    assertCampaignWindow(start, end);
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
        start_date: start,
        end_date: end,
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

    // Only known columns — the PATCH body is not run through the DTO validator.
    const allowed: (keyof CreateCampaignDto)[] = [
      'name', 'type', 'code', 'requires_code', 'discount_type', 'discount_value', 'buy_qty', 'get_qty',
      'free_shipping', 'free_gift_product_id', 'usage_limit', 'product_ids', 'is_active', 'image_url', 'headline', 'body',
    ];
    const data: any = {};
    for (const key of allowed) if ((dto as any)[key] !== undefined) data[key] = (dto as any)[key];
    if (dto.code !== undefined) data.code = dto.code || null;
    if (dto.discount_type !== undefined) data.discount_type = dto.discount_type || null;
    if (dto.free_gift_product_id !== undefined) data.free_gift_product_id = dto.free_gift_product_id || null;

    // Dates can be changed or cleared (null / "" = no limit).
    const start = parseCampaignDate((dto as any).start_date, 'start');
    const end = parseCampaignDate((dto as any).end_date, 'end');
    if (start !== undefined) data.start_date = start;
    if (end !== undefined) data.end_date = end;
    assertCampaignWindow(
      start !== undefined ? start : existing.start_date,
      end !== undefined ? end : existing.end_date,
    );

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

    const deliverySettings = await this.deliverySettings.get();
    const baseShipping = deliverySettings.flat_fee;

    let freeShipping = deliverySettings.free_delivery_global;

    const productIds = dto.items.map((i) => i.product_id).filter(Boolean);
    if (!freeShipping && productIds.length > 0) {
      const freeDeliveryProduct = await this.prisma.product.findFirst({
        where: { id: { in: productIds }, free_delivery: true },
        select: { id: true },
      });
      if (freeDeliveryProduct) freeShipping = true;
    }

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
