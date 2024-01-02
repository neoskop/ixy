import { Module } from '@nestjs/common';
import { ImageService } from './image.service.js';
import { SourceModule } from './source/source.module.js';
import { TargetModule } from './target/target.module.js';
import { ImageController } from './image.controller.js';
import { CacheModule } from '../cache/cache.module.js';
import { CacheUpdateModule } from '../cache/cache-update/cache-update.module.js';

@Module({
  providers: [ImageService],
  imports: [SourceModule, TargetModule, CacheModule, CacheUpdateModule],
  controllers: [ImageController],
})
export class ImageModule {}
