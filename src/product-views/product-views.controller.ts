import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { ProductViewsService } from './product-views.service';

@Controller('products/:id/views')
export class ProductViewsController {
  constructor(private readonly productViewsService: ProductViewsService) {}

  @Post('heartbeat')
  async heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    const count = await this.productViewsService.heartbeat(id, dto.session_id);
    return { count };
  }

  @Get('count')
  async count(@Param('id') id: string) {
    const count = await this.productViewsService.activeCount(id);
    return { count };
  }
}
