import { Module } from '@nestjs/common';
import { TargetService } from './target.service.js';
import { CacheModule } from '../../cache/cache.module.js';

@Module({
  providers: [TargetService],
  exports: [TargetService],
  imports: [CacheModule],
})
export class TargetModule {}
