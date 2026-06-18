import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  private key(policyKey: string) {
    return `policy:${policyKey}`;
  }

  async get(policyKey: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key: this.key(policyKey) },
    });
    return setting?.value ?? { content: '' };
  }

  async upsert(policyKey: string, data: Record<string, any>) {
    return this.prisma.setting.upsert({
      where: { key: this.key(policyKey) },
      update: { value: data },
      create: { key: this.key(policyKey), value: data },
    });
  }
}
