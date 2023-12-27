import { Injectable } from '@nestjs/common';
import { CacheUpdateService } from '../cache/cache-update/cache-update.service.js';
import { TargetService } from './target/target.service.js';
import { CacheService } from '../cache/cache.service.js';
import { SourceService } from './source/source.service.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ImageService {
  constructor(
    private readonly sourceService: SourceService,
    private readonly cacheService: CacheService,
    private readonly cacheUpdateService: CacheUpdateService,
    private readonly targetService: TargetService,
    private readonly configService: ConfigService,
  ) {}

  private async fetchSourceImage(path: string, loadFromCache = true) {
    const baseUrl = this.configService.getOrThrow<string>('BASE_URL');
    const url = `${baseUrl}${path}`;

    let arrayBuffer: ArrayBuffer | null = null;
    if (loadFromCache) {
      arrayBuffer = await this.cacheService.loadFileFromCache('src', path);
    }

    if (!arrayBuffer) {
      const { lastModified, arrayBuffer } =
        await this.sourceService.downloadSourceImage(url);
      await this.cacheService.storeFileInCache(
        'src',
        path,
        arrayBuffer,
        lastModified,
      );
    }

    return arrayBuffer;
  }

  public async getResizedImage(
    path: string,
    parsedWidth: number,
    parsedHeight: number,
  ) {
    let resizedImage = await this.targetService.fetchExistingTargetImage(
      path,
      parsedWidth,
      parsedHeight,
    );

    if (!resizedImage) {
      const image = await this.fetchSourceImage(path);
      resizedImage = await this.targetService.resizeImage(
        path,
        image,
        parsedWidth,
        parsedHeight,
      );
    } else {
      this.cacheUpdateService.updateInBackground(path);
    }

    return resizedImage;
  }
}
