import { canonicalizeFileName } from "./canonicalize-filename.js";
import fs from "fs/promises";
import { measured } from "../util/measured.js";
import chalk from "chalk";
import { logger } from "../util/logger.js";

export async function storeFileInCache(
  directory,
  fileName,
  arrayBuffer,
  lastModified
) {
  const fullDir = `${process.env.CACHE_DIR}/${directory}`;
  const fullPath = `${fullDir}/${canonicalizeFileName(fileName)}`;

  await measured(async () => {
    await fs.mkdir(fullDir, { recursive: true });
    await fs.writeFile(fullPath, Buffer.from(arrayBuffer));
    if (lastModified) {
      const lastModifiedDate = new Date(lastModified);
      logger.debug(
        `Setting modfied date of ${chalk.bold(
          lastModifiedDate.toLocaleString()
        )}`
      );
      await fs.utimes(fullPath, Date.now(), lastModifiedDate);
    }
  }, `Wrote image to cache under ${chalk.bold(fullPath)}`);
}
