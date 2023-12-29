import { Controller, Get } from '@nestjs/common';
import { CacheStatusService } from './cache-status.service.js';

@Controller('cache')
export class CacheStatusController {
  constructor(private readonly cacheStatusService: CacheStatusService) {}

  @Get()
  public status() {
    return this.cacheStatusService.status();
  }

  @Get('all')
  public statusAll() {
    return this.cacheStatusService.statusAll();
  }
}
