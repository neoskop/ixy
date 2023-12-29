import { Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { DistributionModule } from '../distribution/distribution.module.js';
import { CacheStatusModule } from './cache-status/cache-status.module.js';

@Module({
  providers: [CacheService],
  exports: [CacheService],
  imports: [DistributionModule, CacheStatusModule],
})
export class CacheModule {}
