import { Injectable } from '@nestjs/common';
import { CacheUpdateService } from '../cache/cache-update/cache-update.service.js';
import { TargetService } from './target/target.service.js';
import { SourceService } from './source/source.service.js';

@Injectable()
export class ImageService {
  constructor(
    private readonly sourceService: SourceService,
    private readonly cacheUpdateService: CacheUpdateService,
    private readonly targetService: TargetService,
  ) {}

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
      const image = await this.sourceService.fetchSourceImage(path);
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
