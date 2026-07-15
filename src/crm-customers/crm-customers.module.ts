import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmCustomersController } from './crm-customers.controller';
import { CrmCustomersService } from './crm-customers.service';

@Module({ imports: [PrismaModule], controllers: [CrmCustomersController], providers: [CrmCustomersService], exports: [CrmCustomersService] })
export class CrmCustomersModule {}
