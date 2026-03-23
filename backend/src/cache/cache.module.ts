import { Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { CacheStatusModule } from './cache-status/cache-status.module.js';

@Module({
  providers: [CacheService],
  exports: [CacheService],
  imports: [CacheStatusModule],
})
export class CacheModule {}
