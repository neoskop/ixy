import { Injectable, Logger } from '@nestjs/common';
import glob from 'fast-glob';
import { eachLimit } from 'async';
import chalk from 'chalk';
import fs from 'fs/promises';
import axios, { AxiosResponse } from 'axios';
import { canonicalizeFileName } from '../../util/canonicalize-filename.js';
import { CacheService } from '../cache.service.js';
import { TargetService } from '../../image/target/target.service.js';
import { ConfigService } from '@nestjs/config';
import { ParsedArgs } from '../../image/parsed-args.js';
import { Stats } from 'node:fs';

@Injectable()
export class CacheUpdateService {
  constructor(
    private readonly cacheService: CacheService,
    private readonly targetService: TargetService,
    private readonly configService: ConfigService,
  ) {}

  public async updateTargetImages(
    path: string,
    sourceImageArrayBuffer: Buffer,
  ) {
    const targetPath = `${this.configService.getOrThrow<string>(
      'CACHE_DIR',
    )}/target/${canonicalizeFileName(path)}/*.webp`;
    const imageFiles = await glob(targetPath);

    await eachLimit(imageFiles, 5, async (imageFile) => {
      const targetWidth = parseInt(
        RegExp(/\/(\d+)-\d+\.webp$/).exec(imageFile)[1],
      );
      const targetHeight = parseInt(
        RegExp(/\/\d+-(\d+)\.webp$/).exec(imageFile)[1],
      );
      const parsedArgs = ParsedArgs.fromFileName(imageFile);
      await this.targetService.resizeImage(
        path,
        sourceImageArrayBuffer,
        targetWidth,
        targetHeight,
        parsedArgs,
      );
      Logger.log(`Updated target image ${chalk.bold(imageFile)}`);
    });
  }

  private async updateCachedImages(response: AxiosResponse, path: string) {
    await this.cacheService.storeFileInCache(
      'src',
      path,
      response.data,
      response.headers['last-modified'],
    );
    await this.updateTargetImages(path, response.data);
  }

  public async updateInBackground(path: string) {
    const url = `${this.configService.getOrThrow<string>('BASE_URL')}${path}`;
    const fullPath = `${this.configService.getOrThrow<string>(
      'CACHE_DIR',
    )}/src/${canonicalizeFileName(path)}`;

    let stats: Stats;

    try {
      stats = await fs.stat(fullPath);
    } catch (e) {
      return;
    }

    if (
      stats.ctime.getTime() >=
      Date.now() -
        Number(this.configService.getOrThrow<string>('REVALIDATE_AFTER')) *
          60 *
          1000
    ) {
      Logger.debug(
        `Don't have to check ${chalk.bold(
          fullPath,
        )} for changes (Creation date: ${chalk.bold(
          stats.ctime.toLocaleString('de-DE'),
        )} is not older than ${chalk.bold(
          this.configService.getOrThrow<string>('REVALIDATE_AFTER'),
        )} minutes)`,
      );
      return;
    }

    let newMtime = stats.mtime;
    Logger.debug(
      `Checking ${chalk.bold(
        fullPath,
      )} if it was modified since last download at ${chalk.bold(
        stats.ctime.toLocaleTimeString('de-DE'),
      )} (Last modified date: ${chalk.bold(
        stats.mtime.toLocaleString('de-DE'),
      )})`,
    );

    try {
      const lastModifiedHeader = stats.mtime.toUTCString();
      const response = await axios.get(url, {
        timeout:
          Number(this.configService.getOrThrow<string>('TIMEOUT')) * 1000,
        maxRedirects: Number(
          this.configService.getOrThrow<string>('MAX_REDIRECTS'),
        ),
        maxContentLength:
          Number(this.configService.getOrThrow<string>('MAX_SIZE')) *
          1024 *
          1024,
        headers: {
          'If-Modified-Since': lastModifiedHeader,
        },
        responseType: 'arraybuffer',
        validateStatus: function (status) {
          return status < 300 || status == 304;
        },
      });

      if (response.status === 304) {
        Logger.debug(`The image hasn't changed! Nothing to do.`);
      } else {
        Logger.debug(`The image has changed ... updating!`);
        await this.updateCachedImages(response, path);
        newMtime = new Date(response.headers['last-modified']);
      }
    } catch (error) {
      Logger.error(
        `Failed to check ${chalk.bold(fullPath)} for changes: ${error.message}`,
      );
    }

    await fs.utimes(fullPath, Date.now(), newMtime);
  }
}
