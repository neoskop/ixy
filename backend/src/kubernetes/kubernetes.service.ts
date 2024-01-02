import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import k8s from '@kubernetes/client-node';
import { Writable } from 'stream';
import chalk from 'chalk';

@Injectable()
export class KubernetesService {
  private kubeConfig: k8s.KubeConfig;
  private client: k8s.CoreV1Api;
  private cp: k8s.Cp;
  private executor: k8s.Exec;
  public namespace: string;
  public currentPodName: string;

  constructor(private readonly configService: ConfigService) {
    this.kubeConfig = new k8s.KubeConfig();
    this.kubeConfig.loadFromCluster();
    this.client = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.cp = new k8s.Cp(this.kubeConfig);
    this.executor = new k8s.Exec(this.kubeConfig);
    this.namespace = this.configService.get<string>('MY_POD_NAMESPACE');
    this.currentPodName = this.configService.get<string>('MY_POD_NAME');
  }

  public copyFromPod(
    podName: string,
    containerName: string,
    sourcePath: string,
    targetPath: string,
    cwd: string,
  ) {
    return this.cp.cpFromPod(
      this.namespace,
      podName,
      containerName,
      sourcePath,
      targetPath,
      cwd,
    );
  }

  public copyToPod(
    podName: string,
    containerName: string,
    sourcePath: string,
    targetPath: string,
    cwd: string,
  ) {
    return this.cp.cpToPod(
      this.namespace,
      podName,
      containerName,
      sourcePath,
      targetPath,
      cwd,
    );
  }

  public async exec(podName: string, command: string[]) {
    const outputStream = new Writable();
    let output = '';
    outputStream._write = function (chunk, _encoding, done) {
      output += chunk.toString();
      done();
    };
    return await new Promise<string[]>((resolve, reject) =>
      this.executor.exec(
        this.namespace,
        podName,
        'ixy',
        command,
        outputStream,
        outputStream,
        null,
        false,
        (status) => {
          if (status.status === 'Success') {
            resolve(output.split('\n'));
          } else {
            reject(
              new Error(
                `${chalk.bold(command.join(' '))} in ${chalk.bold(
                  podName,
                )} failed: ${output}`,
              ),
            );
          }
        },
      ),
    );
  }

  public async findAllSiblings(): Promise<
    { name: string; ip: string; ready: boolean; phase: string }[]
  > {
    const pods = await this.client.listNamespacedPod(
      this.namespace,
      null,
      false,
      null,
      null,
      'app.kubernetes.io/name=ixy',
    );

    return pods.body.items
      .filter((pod) => pod.metadata.name !== this.currentPodName)
      .map((pod) => ({
        name: pod.metadata.name,
        ip: pod.status.podIP,
        ready: pod.status.containerStatuses?.every((c) => c.ready),
        phase: pod.status.phase,
      }));
  }

  public async findReadySiblingNames(): Promise<string[]> {
    const siblings = await this.findAllSiblings();
    return siblings
      .filter((s) => s.ready && s.phase === 'Running')
      .map((s) => s.name);
  }
}
