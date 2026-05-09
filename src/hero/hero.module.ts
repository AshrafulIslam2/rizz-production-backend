import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  imports: [PrismaModule],
  controllers: [HeroController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}
