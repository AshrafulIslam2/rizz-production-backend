import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({ imports: [PrismaModule, InventoryModule], controllers: [PurchaseOrdersController], providers: [PurchaseOrdersService], exports: [PurchaseOrdersService] })
export class PurchaseOrdersModule {}
