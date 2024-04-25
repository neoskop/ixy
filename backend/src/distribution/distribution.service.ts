import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import chalk from 'chalk';
import fs from 'fs';
import { basename } from 'path';
import { KubernetesService } from '../kubernetes/kubernetes.service.js';
import pRetry from 'p-retry';

@Injectable()
export class DistributionService implements OnApplicationBootstrap {
  private colors = [
    chalk.red,
    chalk.blue,
    chalk.green,
    chalk.yellow,
    chalk.magenta,
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly kubernetesService: KubernetesService,
  ) {}

  public async onApplicationBootstrap() {
    if (!this.isDistributionEnabled()) {
      return;
    }

    const podNames = await this.kubernetesService.findReadySiblingNames();

    if (podNames.length === 0) {
      Logger.debug(
        `No ready sibling pods found. Skipping initialization of cache`,
      );
      return;
    }

    try {
      await this.copyFilesFromPod(podNames[0]);
    } catch (err) {
      Logger.error(
        `Failed to copy files from ${this.getPodLogColor(podNames[0])(podNames[0])}: ${err.message}`,
      );
    }
  }

  private isDistributionEnabled() {
    return this.configService.getOrThrow<string>('DISTRIBUTION') === 'true';
  }

  private getPodLogColor(pod: string) {
    const hash = pod
      .split('')
      .map((char) => char.charCodeAt(0))
      .reduce((a, b) => a + b, 0);

    return this.colors[hash % this.colors.length].bold;
  }

  public async distribute(path: string): Promise<void> {
    if (!this.isDistributionEnabled()) {
      return;
    }

    const siblingPodNames =
      await this.kubernetesService.findReadySiblingNames();

    for (const podName of siblingPodNames) {
      try {
        await this.copyToPod(podName, path);
        Logger.log(
          `Distributed ${chalk.bold(path)} to ${this.getPodLogColor(podName)(
            podName,
          )}`,
        );
      } catch (err) {
        Logger.error(
          `Failed to distribute ${chalk.bold(path)} to ${this.getPodLogColor(
            podName,
          )(podName)}: ${err.message}`,
        );
      }
    }
  }

  private async copyFilesFromPod(podName: string) {
    const files = (
      await this.kubernetesService.exec(podName, [
        'find',
        this.configService.get<string>('CACHE_DIR'),
        '!',
        '-readable',
        '-prune',
        '-o',
        '-type',
        'f',
      ])
    ).filter(Boolean);

    const copyBatchSize = Number(
      this.configService.get<string>('COPY_BATCH_SIZE'),
    );

    for (let i = 0; i < files.length; i += copyBatchSize) {
      const fileBatch = files.slice(i, i + copyBatchSize);
      Logger.debug(
        `Copying ${chalk.bold(
          fileBatch.length,
        )} files from ${chalk.bold(podName)}`,
      );

      await Promise.all(
        fileBatch.map(async (file) => {
          try {
            Logger.debug(`Copying ${chalk.bold(file)}`);
            await this.copyFromPod(podName, file);
          } catch (err) {
            Logger.error(
              `Failed to copy ${chalk.bold(file)} from ${chalk.bold(
                podName,
              )}: ${err.message}`,
            );
          }
        }),
      );
    }
  }

  private async copyFromPod(pod: string, path: string): Promise<void> {
    const directoryName = path.substring(0, path.lastIndexOf('/'));

    await pRetry(
      async () => {
        await this.createLocalDirectoriesIfNeeded(directoryName);
        await this.kubernetesService.copyFromPod(
          pod,
          'ixy',
          basename(path),
          directoryName,
          directoryName,
        );
      },
      {
        retries: Number(this.configService.get<string>('COPY_RETRY_COUNT')),
        minTimeout: 1000,
        maxTimeout:
          Math.pow(
            2,
            Number(this.configService.get<string>('COPY_RETRY_COUNT')),
          ) * 1000,
        randomize: true,
      },
    );
  }

  private async createLocalDirectoriesIfNeeded(path: string): Promise<void> {
    await fs.promises.mkdir(path, { recursive: true });
  }

  private async copyToPod(pod: string, path: string): Promise<void> {
    const directoryName = path.substring(0, path.lastIndexOf('/'));
    const retries = Number(this.configService.get<string>('COPY_RETRY_COUNT'));

    await pRetry(
      async () => {
        await this.createRemoteDirectoriesIfNeeded(pod, directoryName);
        await this.kubernetesService.copyToPod(
          pod,
          'ixy',
          basename(path),
          directoryName,
          directoryName,
        );
      },
      {
        retries,
        minTimeout: 1000,
        maxTimeout: Math.pow(2, retries) * 1000,
        randomize: true,
      },
    );
  }

  private async createRemoteDirectoriesIfNeeded(
    pod: string,
    path: string,
  ): Promise<void> {
    try {
      await this.kubernetesService.exec(pod, ['mkdir', '-p', path]);
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
