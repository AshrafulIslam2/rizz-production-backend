import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SETTING_KEY = 'delivery_settings';
const DEFAULTS = { free_delivery_global: false, flat_fee: 60 };

export type DeliverySettings = typeof DEFAULTS;

@Injectable()
export class DeliverySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<DeliverySettings> {
    const setting = await this.prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    return { ...DEFAULTS, ...(setting?.value as Partial<DeliverySettings> | undefined) };
  }

  async update(data: Partial<DeliverySettings>): Promise<DeliverySettings> {
    const current = await this.get();
    const next = { ...current, ...data };
    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: next },
      create: { key: SETTING_KEY, value: next },
    });
    return next;
  }
}
