import { Module } from '@nestjs/common';
import { CacheModule } from './cache/cache.module.js';
import { ImageModule } from './image/image.module.js';
import { ConfigModule } from '@nestjs/config';
import { DistributionModule } from './distribution/distribution.module.js';
import { HealthModule } from './health/health.module.js';
import { KubernetesModule } from './kubernetes/kubernetes.module.js';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    CacheModule,
    ImageModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['config/.env', 'config/.env.default'],
    }),
    ServeStaticModule.forRoot({
      rootPath: '/home/node/app/ui',
      serveRoot: '/ui',
    }),
    DistributionModule,
    HealthModule,
    KubernetesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
