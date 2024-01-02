import { Module } from '@nestjs/common';
import { CacheStatusService } from './cache-status.service.js';
import { CacheStatusController } from './cache-status.controller.js';
import { KubernetesModule } from '../../kubernetes/kubernetes.module.js';

@Module({
  providers: [CacheStatusService],
  controllers: [CacheStatusController],
  imports: [KubernetesModule],
})
export class CacheStatusModule {}
