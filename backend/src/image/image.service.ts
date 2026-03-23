import { Injectable } from '@nestjs/common';
import { CacheUpdateService } from '../cache/cache-update/cache-update.service.js';
import { TargetService } from './target/target.service.js';
import { SourceService } from './source/source.service.js';
import { ParsedArgs } from './parsed-args.js';
import { ClusterRoutingService } from '../cluster/cluster.service.js';

@Injectable()
export class ImageService {
  private readonly inFlight = new Map<string, Promise<Buffer | undefined>>();

  constructor(
    private readonly sourceService: SourceService,
    private readonly cacheUpdateService: CacheUpdateService,
    private readonly targetService: TargetService,
    private readonly clusterRoutingService: ClusterRoutingService,
  ) {}

  public async getResizedImage(
    path: string,
    parsedWidth: number,
    parsedHeight: number,
    parsedArgs: ParsedArgs,
    requestPath: string,
    forwardedBy?: string,
  ) {
    const requestKey = this.buildRequestKey(
      path,
      parsedWidth,
      parsedHeight,
      parsedArgs,
    );

    return this.singleflight(requestKey, async () => {
      const forwardedImage =
        await this.clusterRoutingService.maybeForwardRequest(
          path,
          requestPath,
          forwardedBy,
        );

      if (forwardedImage) {
        return forwardedImage;
      }

      let resizedImage: Buffer | undefined = await this.targetService.fetchExistingTargetImage(
        path,
        parsedWidth,
        parsedHeight,
        parsedArgs,
      );

      if (!resizedImage) {
        const image = await this.sourceService.fetchSourceImage(path);
        resizedImage = await this.targetService.resizeImage(
          path,
          image,
          parsedWidth,
          parsedHeight,
          parsedArgs,
        );
      } else {
        this.cacheUpdateService.updateInBackground(path);
      }

      return resizedImage;
    });
  }

  private buildRequestKey(
    path: string,
    width: number,
    height: number,
    parsedArgs: ParsedArgs,
  ) {
    return `${path}|${width}x${height}${parsedArgs}`;
  }

  private async singleflight<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return (await existing) as T;
    }

    const pending = operation().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, pending as Promise<Buffer | undefined>);
    return await pending;
  }
}
