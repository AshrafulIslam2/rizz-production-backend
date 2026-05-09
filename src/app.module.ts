import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HeroModule } from './hero/hero.module';
import { PrismaModule } from './prisma/prisma.module';
import { PagesModule } from './pages/pages.module';

@Module({
  imports: [PrismaModule, PagesModule, HeroModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
