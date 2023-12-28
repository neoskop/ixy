import { Module } from '@nestjs/common';
import { CacheService } from './cache.service.js';
import { DistributionModule } from '../distribution/distribution.module.js';

@Module({
  providers: [CacheService],
  exports: [CacheService],
  imports: [DistributionModule],
})
export class CacheModule {}
