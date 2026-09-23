import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { queue, QueueObject } from 'async';
import sharp from 'sharp';
import { CacheService } from '../../cache/cache.service.js';
import { canonicalizeFileName } from '../../util/canonicalize-filename.js';
import { measured } from '../../util/measured.js';
import { ParsedArgs } from '../parsed-args.js';

@Injectable()
export class TargetService {
  // Every resize (request and background update) goes through this queue so
  // peak memory is bounded by RESIZE_CONCURRENCY decoded images, not by load.
  private readonly resizeQueue: QueueObject<() => Promise<Buffer>>;

  public constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.resizeQueue = queue(
      async (job: () => Promise<Buffer>) => job(),
      Number(this.configService.getOrThrow<string>('RESIZE_CONCURRENCY')),
    );
  }

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
    image: Buffer | ArrayBuffer,
    targetWidth: number,
    targetHeight: number,
    parsedArgs: ParsedArgs,
  ) {
    try {
      // 0x0 means "the source image", but a full-resolution re-encode of a
      // large source costs hundreds of MiB, so bound it by MAX_WIDTH/HEIGHT.
      const resizeOptions: sharp.ResizeOptions =
        targetWidth == 0 && targetHeight == 0
          ? {
              width: Number(this.configService.getOrThrow('MAX_WIDTH')),
              height: Number(this.configService.getOrThrow('MAX_HEIGHT')),
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            }
          : {
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

      const arrayBuffer = await this.resizeQueue.pushAsync<Buffer>(() =>
        measured(
          () =>
            sharp(image, {
              limitInputPixels: Number(
                this.configService.getOrThrow('MAX_INPUT_PIXELS'),
              ),
            })
              .resize(resizeOptions)
              .withMetadata()
              .webp({ quality: 80 })
              .toBuffer(),
          `Resized image`,
        ),
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
      if (error.message?.includes('pixel limit')) {
        throw new BadRequestException(
          'Source image exceeds the maximum number of pixels.',
        );
      }
      throw error;
    }
  }
}
