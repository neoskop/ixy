import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module.js';
import { ImageModule } from './image/image.module.js';

@Module({
  imports: [CacheModule, ImageModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
