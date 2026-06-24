import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutLeadsController } from './checkout-leads.controller';
import { CheckoutLeadsService } from './checkout-leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutLeadsController],
  providers: [CheckoutLeadsService],
  exports: [CheckoutLeadsService],
})
export class CheckoutLeadsModule {}
