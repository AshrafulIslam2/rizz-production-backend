import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'rizz-admin-panel-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
