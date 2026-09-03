import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockReconcileService } from './stock-reconcile.service';

@Module({ imports: [PrismaModule], controllers: [InventoryController], providers: [InventoryService, StockReconcileService], exports: [InventoryService] })
export class InventoryModule {}
