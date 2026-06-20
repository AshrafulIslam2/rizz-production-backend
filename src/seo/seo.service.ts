import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  private key(pageKey: string) {
    return `seo:${pageKey}`;
  }

  async get(pageKey: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: this.key(pageKey) },
    });
    return setting?.value ?? {};
  }

  async upsert(pageKey: string, data: Record<string, any>) {
    return this.prisma.setting.upsert({
      where: { key: this.key(pageKey) },
      update: { value: data },
      create: { key: this.key(pageKey), value: data },
    });
  }
}
