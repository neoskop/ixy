import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import chalk from 'chalk';
import { CacheService } from '../../cache/cache.service.js';
import { measured } from '../../util/measured.js';

@Injectable()
export class SourceService {
  constructor(private readonly cacheService: CacheService) {}

  public async downloadSourceImage(url: string) {
    try {
      return await measured(async () => {
        const response = await axios.get(url, {
          timeout: Number(process.env.TIMEOUT) * 1000,
          maxContentLength: Number(process.env.MAX_SIZE) * 1024 * 1024,
          maxRedirects: Number(process.env.MAX_REDIRECTS),
          responseType: 'arraybuffer',
        });
        return {
          lastModified: response.headers['last-modified'],
          arrayBuffer: response.data,
        };
      }, `Fetched source image from ${chalk.bold(url)}`);
    } catch (err) {
      if (err.response?.status === 404) {
        throw new NotFoundException(`Source image not found`);
      } else {
        throw err;
      }
    }
  }

  public async fetchSourceImage(path: string, loadFromCache = true) {
    const url = `${process.env.BASE_URL}${path}`;
    let arrayBuffer = loadFromCache
      ? await this.cacheService.loadFileFromCache('src', path)
      : null;

    if (arrayBuffer) {
      return arrayBuffer;
    } else {
      let lastModified: string;

      ({ lastModified, arrayBuffer } = await this.downloadSourceImage(url));
      await this.cacheService.storeFileInCache(
        'src',
        path,
        arrayBuffer,
        lastModified,
      );
    }

    return arrayBuffer;
  }
}
