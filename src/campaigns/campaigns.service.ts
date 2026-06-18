import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.campaign.findMany({ orderBy: { created_at: 'desc' } });
  }

  async create(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        type: dto.type,
        code: dto.code,
        discount_value: dto.discount_value,
        discount_type: dto.discount_type,
        start_date: dto.start_date ? new Date(dto.start_date) : null,
        end_date: dto.end_date ? new Date(dto.end_date) : null,
        is_active: dto.is_active ?? true,
        image_url: dto.image_url,
        headline: dto.headline,
        body: dto.body,
      } as any,
    });
  }

  async update(id: string, dto: Partial<CreateCampaignDto>) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } as any });
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);

    const data: any = { ...dto };
    if (dto.start_date) data.start_date = new Date(dto.start_date);
    if (dto.end_date) data.end_date = new Date(dto.end_date);

    return this.prisma.campaign.update({ where: { id } as any, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.campaign.findUnique({ where: { id } as any });
    if (!existing) throw new NotFoundException(`Campaign ${id} not found`);
    return this.prisma.campaign.delete({ where: { id } as any });
  }
}
