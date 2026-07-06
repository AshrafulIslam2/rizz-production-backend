import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';

@Module({
  imports: [PrismaModule],
  controllers: [AboutController],
  providers: [AboutService],
})
export class AboutModule {}
