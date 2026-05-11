import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HeroByIdController } from './hero-by-id.controller';
import { HeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  imports: [PrismaModule],
  controllers: [HeroController, HeroByIdController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}
