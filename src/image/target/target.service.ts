import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { CacheService } from '../../cache/cache.service.js';
import { canonicalizeFileName } from '../../util/canonicalize-filename.js';
import { measured } from '../../util/measured.js';

@Injectable()
export class TargetService {
  public constructor(private readonly cacheService: CacheService) {}

  public async fetchExistingTargetImage(
    path: string,
    parsedWidth: number,
    parsedHeight: number,
  ) {
    const arrayBuffer = await this.cacheService.loadFileFromCache(
      `target/${canonicalizeFileName(path)}`,
      `${parsedWidth}-${parsedHeight}.webp`,
    );

    if (arrayBuffer) {
      return Buffer.from(arrayBuffer);
    }
  }

  public async resizeImage(
    path: string,
    image: ArrayBuffer,
    targetWidth: number,
    targetHeight: number,
  ) {
    try {
      const arrayBuffer = await measured(
        () =>
          sharp(image)
            .resize({
              width: targetWidth,
              height: targetHeight,
              fit: sharp.fit.cover,
            })
            .withMetadata()
            .webp({ quality: 80 })
            .toBuffer(),
        `Resized image`,
      );
      await this.cacheService.storeFileInCache(
        `target/${canonicalizeFileName(path)}`,
        `${targetWidth}-${targetHeight}.webp`,
        arrayBuffer,
        Date.now(),
      );
      return arrayBuffer;
    } catch (error) {
      Logger.error(`Failed to resize image: ${path}`, error);
    }
  }
}
