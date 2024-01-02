import { Module } from '@nestjs/common';
import { CacheUpdateService } from './cache-update.service.js';
import { TargetModule } from '../../image/target/target.module.js';
import { CacheModule } from '../cache.module.js';

@Module({
  providers: [CacheUpdateService],
  exports: [CacheUpdateService],
  imports: [TargetModule, CacheModule],
})
export class CacheUpdateModule {}
