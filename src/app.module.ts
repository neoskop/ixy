import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module.js';
import { ImageModule } from './image/image.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [CacheModule, ImageModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [],
  providers: [],
})
export class AppModule {}
