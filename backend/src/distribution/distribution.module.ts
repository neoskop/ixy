import { Module } from '@nestjs/common';
import { DistributionService } from './distribution.service.js';
import { KubernetesModule } from '../kubernetes/kubernetes.module.js';

@Module({
  providers: [DistributionService],
  exports: [DistributionService],
  imports: [KubernetesModule],
})
export class DistributionModule {}
