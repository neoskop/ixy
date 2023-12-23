import { Injectable, Logger } from '@nestjs/common';
import chalk from 'chalk';
import fs from 'fs/promises';
import { measured } from '../util/measured.js';
import { canonicalizeFileName } from '../util/canonicalize-filename.js';

@Injectable()
export class CacheService {
  public async loadFileFromCache(directory: string, fileName: string) {
    const fullPath = `${
      process.env.CACHE_DIR
    }/${directory}/${canonicalizeFileName(fileName)}`;
    const fileExists = await fs
      .access(fullPath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      const fileContent = await measured(
        async () => await fs.readFile(fullPath),
        `Loaded cached image from ${chalk.bold(fullPath)}`,
      );
      return fileContent.buffer;
    }
  }

  public async storeFileInCache(
    directory: string,
    fileName: string,
    arrayBuffer: ArrayBuffer,
    lastModified: string | number,
  ) {
    const fullDir = `${process.env.CACHE_DIR}/${directory}`;
    const fullPath = `${fullDir}/${canonicalizeFileName(fileName)}`;

    await measured(async () => {
      await fs.mkdir(fullDir, { recursive: true });
      await fs.writeFile(fullPath, Buffer.from(arrayBuffer));
      if (lastModified) {
        const lastModifiedDate = new Date(lastModified);
        Logger.debug(
          `Setting modfied date of ${chalk.bold(
            lastModifiedDate.toLocaleString(),
          )}`,
        );
        await fs.utimes(fullPath, Date.now(), lastModifiedDate);
      }
    }, `Wrote image to cache under ${chalk.bold(fullPath)}`);
  }
}
