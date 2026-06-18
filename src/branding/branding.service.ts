import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BRANDING_KEY = 'branding';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: BRANDING_KEY },
    });
    return setting?.value ?? {};
  }

  async upsert(data: Record<string, any>) {
    return this.prisma.setting.upsert({
      where: { key: BRANDING_KEY },
      update: { value: data },
      create: { key: BRANDING_KEY, value: data },
    });
  }
}
