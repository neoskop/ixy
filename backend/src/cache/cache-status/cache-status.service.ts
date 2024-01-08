import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import { join } from 'path';
import { KubernetesService } from '../../kubernetes/kubernetes.service.js';
import axios from 'axios';

@Injectable()
export class CacheStatusService {
  constructor(
    private readonly configService: ConfigService,
    private readonly kubernetesService: KubernetesService,
  ) {}

  public async statusAll() {
    if (this.configService.get<string>('DISTRIBUTION') !== 'true') {
      return {};
    }

    const result = {};
    result[this.kubernetesService.currentPodName] = {
      phase: 'Running',
      ready: true,
      ...(await this.status()),
    };

    const siblings = await this.kubernetesService.findAllSiblings();
    for (const pod of siblings) {
      const { phase, ready, ip, name } = pod;
      if (phase === 'Running' && ready) {
        const port = this.configService.getOrThrow<string>('PORT');
        const response = await axios.get(`http://${ip}:${port}/cache`);
        result[name] = { phase, ready, ...response.data };
      } else {
        result[name] = { phase, ready };
      }
    }

    return result;
  }

  async status() {
    const sourceFiles = await this.getFiles('src');
    const targetFiles = await this.getFiles('target');

    const result: any = {
      source: {
        count: sourceFiles.length,
        size: await this.getDirectorySize(sourceFiles),
      },
      target: {
        count: targetFiles.length,
        size: await this.getDirectorySize(targetFiles),
      },
    };

    const debug =
      this.configService.getOrThrow<string>('DEBUG') === 'true' || true;

    if (debug) {
      result.source.files = await this.getFiles('src');
      result.target.files = await this.getFiles('target');
    }
    return result;
  }

  private async getFiles(directory: string): Promise<string[]> {
    const cacheDir = this.configService.getOrThrow<string>('CACHE_DIR');
    const path = join(cacheDir, directory);

    try {
      const files = await fs.promises.readdir(path);
      const result = [];

      for (const file of files) {
        const filePath = join(path, file);
        const stats = await fs.promises.lstat(filePath);

        if (stats.isFile()) {
          result.push(filePath);
        } else {
          result.push(...(await this.getFiles(join(directory, file))));
        }
      }
      return result;
    } catch (e) {
      return [];
    }
  }

  private async getDirectorySize(files: string[]) {
    let totalSize = 0;

    for (const file of files) {
      const stats = await fs.promises.stat(file);
      totalSize += stats.size;
    }

    return totalSize;
  }
}
