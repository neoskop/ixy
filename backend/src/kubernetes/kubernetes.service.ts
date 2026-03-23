import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';

@Injectable()
export class KubernetesService {
  private kubeConfig: KubeConfig;
  private client: CoreV1Api;
  public namespace: string;
  public currentPodName: string;

  constructor(private readonly configService: ConfigService) {
    this.kubeConfig = new KubeConfig();
    this.kubeConfig.loadFromCluster();
    this.client = this.kubeConfig.makeApiClient(CoreV1Api);
    this.namespace = this.configService.get<string>('MY_POD_NAMESPACE');
    this.currentPodName = this.configService.get<string>('MY_POD_NAME');
  }

  public async findAllSiblings(): Promise<
    { name: string; ip: string; ready: boolean; phase: string }[]
  > {
    const pods = await this.listPods();
    return pods.filter((pod) => pod.name !== this.currentPodName);
  }

  public async findReadyPods(): Promise<
    { name: string; ip: string; ready: boolean; phase: string }[]
  > {
    const pods = await this.listPods();
    return pods.filter((pod) => pod.ready && pod.phase === 'Running');
  }

  private async listPods(): Promise<
    { name: string; ip: string; ready: boolean; phase: string }[]
  > {
    const pods = await this.client.listNamespacedPod({
      namespace: this.namespace,
      labelSelector: 'app.kubernetes.io/name=ixy',
    });

    return pods.items.map((pod) => ({
      name: pod.metadata.name,
      ip: pod.status.podIP,
      ready: pod.status.containerStatuses?.every((c) => c.ready) ?? false,
      phase: pod.status.phase,
    }));
  }
}
