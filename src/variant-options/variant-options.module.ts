import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VariantOptionsController } from './variant-options.controller';
import { VariantOptionsService } from './variant-options.service';

@Module({
  imports: [PrismaModule],
  controllers: [VariantOptionsController],
  providers: [VariantOptionsService],
  exports: [VariantOptionsService],
})
export class VariantOptionsModule {}
