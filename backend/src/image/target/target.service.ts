import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { CacheService } from '../../cache/cache.service.js';
import { canonicalizeFileName } from '../../util/canonicalize-filename.js';
import { measured } from '../../util/measured.js';
import { ParsedArgs } from '../parsed-args.js';

@Injectable()
export class TargetService {
  public constructor(private readonly cacheService: CacheService) {}

  public async fetchExistingTargetImage(
    path: string,
    parsedWidth: number,
    parsedHeight: number,
    parsedArgs: ParsedArgs,
  ) {
    const arrayBuffer = await this.cacheService.loadFileFromCache(
      `target/${canonicalizeFileName(path)}`,
      `${parsedWidth}-${parsedHeight}${parsedArgs}.webp`,
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
    parsedArgs: ParsedArgs,
  ) {
    try {
      const resizeOptions: sharp.ResizeOptions = {
        width: targetWidth == 0 ? undefined : targetWidth,
        height: targetHeight == 0 ? undefined : targetHeight,
        fit: sharp.fit.cover,
      };

      if (parsedArgs.gravity) {
        resizeOptions.position = parsedArgs.gravity;
      }

      if (parsedArgs.strategy) {
        resizeOptions.position = parsedArgs.strategy;
      }

      const arrayBuffer = await measured(
        () =>
          sharp(image)
            .resize(resizeOptions)
            .withMetadata()
            .webp({ quality: 80 })
            .toBuffer(),
        `Resized image`,
      );
      await this.cacheService.storeFileInCache(
        `target/${canonicalizeFileName(path)}`,
        `${targetWidth}-${targetHeight}${parsedArgs}.webp`,
        arrayBuffer,
        Date.now(),
      );
      return arrayBuffer;
    } catch (error) {
      Logger.error(`Failed to resize image: ${path}`, error);
    }
  }
}
