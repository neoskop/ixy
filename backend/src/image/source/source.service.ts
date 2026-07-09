import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import chalk from 'chalk';
import { CacheService } from '../../cache/cache.service.js';
import { measured } from '../../util/measured.js';
import { isImage } from '../../util/is-image.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SourceService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private async downloadSourceImage(url: string) {
    try {
      return await measured(async () => {
        const response = await axios.get<ArrayBuffer>(url, {
          timeout:
            Number(this.configService.getOrThrow<string>('TIMEOUT')) * 1000,
          maxContentLength:
            Number(this.configService.getOrThrow<string>('MAX_SIZE')) *
            1024 *
            1024,
          maxRedirects: Number(
            this.configService.getOrThrow<string>('MAX_REDIRECTS'),
          ),
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
    const url = `${this.configService.getOrThrow<string>('BASE_URL')}${path}`;
    const cached = loadFromCache
      ? await this.cacheService.loadFileFromCache('src', path)
      : null;

    // Ignore cache entries that aren't images (e.g. an upstream error page
    // wrongly cached on a past download) so they get re-fetched and healed.
    if (cached && (await isImage(cached))) {
      return cached;
    }

    const { lastModified, arrayBuffer } = await this.downloadSourceImage(url);
    if (!(await isImage(arrayBuffer))) {
      throw new NotFoundException(`Source is not an image`);
    }
    await this.cacheService.storeFileInCache('src', path, arrayBuffer, lastModified);

    return arrayBuffer;
  }
}
