import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import k8s from '@kubernetes/client-node';
import chalk from 'chalk';
import { basename } from 'path';

@Injectable()
export class DistributionService {
  private kubeConfig: k8s.KubeConfig;
  private client: k8s.CoreV1Api;
  private cp: k8s.Cp;
  private exec: k8s.Exec;
  private namespace: string;
  private currentPodName: string;
  private colors = [
    chalk.red,
    chalk.blue,
    chalk.green,
    chalk.yellow,
    chalk.magenta,
  ];

  constructor(private readonly configService: ConfigService) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromCluster();
    this.client = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.cp = new k8s.Cp(this.kubeConfig);
    this.exec = new k8s.Exec(this.kubeConfig);
    this.namespace = this.configService.get<string>('MY_POD_NAMESPACE');
    this.currentPodName = this.configService.get<string>('MY_POD_NAME');
  }

  private async findTargetPods(): Promise<string[]> {
    try {
      const pods = await this.client.listNamespacedPod(this.namespace);

      return pods.body.items
        .map((pod) => pod.metadata.name)
        .filter((podName) => podName !== this.currentPodName);
    } catch (err) {
      Logger.error(JSON.stringify(err.body));
    }
  }

  private getPodLogColor(pod: string) {
    const hash = pod
      .split('')
      .map((char) => char.charCodeAt(0))
      .reduce((a, b) => a + b, 0);

    return this.colors[hash % this.colors.length].bold;
  }

  public async distribute(path: string): Promise<void> {
    if (this.configService.getOrThrow<string>('DISTRIBUTION') !== 'true') {
      Logger.debug(`Skipping distribution of ${chalk.bold(path)}`);
      return;
    }

    const targetPods = await this.findTargetPods();

    for (const pod of targetPods) {
      await this.copyToPod(this.namespace, pod, path);
      Logger.log(
        `Distributed ${chalk.bold(path)} to ${this.getPodLogColor(pod)(pod)}`,
      );
    }
  }

  private async copyToPod(
    namespace: string,
    pod: string,
    path: string,
  ): Promise<void> {
    const directoryName = path.substring(0, path.lastIndexOf('/'));
    await this.createDirectoriesIfNeeded(pod, directoryName);
    await this.cp.cpToPod(
      namespace,
      pod,
      'ixy',
      basename(path),
      directoryName,
      directoryName,
    );
  }

  private async createDirectoriesIfNeeded(
    pod: string,
    path: string,
  ): Promise<void> {
    try {
      await this.exec.exec(
        this.namespace,
        pod,
        'ixy',
        ['sh', '-c', `mkdir -p ${path}`],
        process.stdout,
        process.stderr,
        process.stdin,
        true /* tty */,
      );
    } catch (err) {
      Logger.error(
        `Failed to create directories ${chalk.bold(path)} in ${chalk.bold(
          pod,
        )}`,
        err,
      );
    }
  }
}
