import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { PoliciesService } from './policies.service';

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get(':key')
  get(@Param('key') key: string) {
    return this.policiesService.get(key);
  }

  @Put(':key')
  upsert(@Param('key') key: string, @Body() data: Record<string, any>) {
    return this.policiesService.upsert(key, data);
  }
}
