import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HomepageService {
  constructor(private readonly prisma: PrismaService) {}

  private key(section: string) {
    return `homepage:${section}`;
  }

  async getSection(section: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: this.key(section) },
    });
    return setting?.value ?? {};
  }

  async upsertSection(section: string, data: Record<string, any>) {
    return this.prisma.setting.upsert({
      where: { key: this.key(section) },
      update: { value: data },
      create: { key: this.key(section), value: data },
    });
  }
}
