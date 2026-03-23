import { Module } from '@nestjs/common';
import { ClusterRoutingService } from './cluster.service.js';
import { KubernetesModule } from '../kubernetes/kubernetes.module.js';

@Module({
  providers: [ClusterRoutingService],
  exports: [ClusterRoutingService],
  imports: [KubernetesModule],
})
export class ClusterModule {}
