import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_WINDOW_MS = 90 * 1000;
const STALE_CLEANUP_MS = 60 * 60 * 1000;

@Injectable()
export class ProductViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async heartbeat(productId: string, sessionId: string) {
    await this.prisma.productView.upsert({
      where: { product_id_session_id: { product_id: productId, session_id: sessionId } },
      create: { product_id: productId, session_id: sessionId },
      update: {},
    });

    // Lazily sweep stale rows so the table doesn't grow unbounded.
    await this.prisma.productView.deleteMany({
      where: { last_seen: { lt: new Date(Date.now() - STALE_CLEANUP_MS) } },
    });

    return this.activeCount(productId);
  }

  async activeCount(productId: string): Promise<number> {
    return this.prisma.productView.count({
      where: {
        product_id: productId,
        last_seen: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      },
    });
  }
}
