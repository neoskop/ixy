import { Module } from '@nestjs/common';
import { SourceService } from './source.service.js';
import { CacheModule } from '../../cache/cache.module.js';

@Module({
  providers: [SourceService],
  exports: [SourceService],
  imports: [CacheModule],
})
export class SourceModule {}
