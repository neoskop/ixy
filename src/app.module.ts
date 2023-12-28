import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module.js';
import { ImageModule } from './image/image.module.js';
import { ConfigModule } from '@nestjs/config';
import { DistributionModule } from './distribution/distribution.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    CacheModule,
    ImageModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['config/.env', 'config/.env.default'],
    }),
    DistributionModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
