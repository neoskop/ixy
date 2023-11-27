import chalk from "chalk";
import fs from "fs/promises";
import axios from "axios";
import { logger } from "../util/logger.js";
import { canonicalizeFileName } from "./canonicalize-filename.js";
import { updateTargetImages } from "./update-target-images.js";

async function updateCachedImages(response, path) {
  await storeFileInCache(
    "src",
    path,
    response.data,
    response.headers["last-modified"]
  );
  await updateTargetImages(path, sourceImageArrayBuffer);
}

export async function updateInBackground(path) {
  const url = `${process.env.BASE_URL}${path}`;
  const fullPath = `${process.env.CACHE_DIR}/src/${canonicalizeFileName(path)}`;

  const stats = await fs.stat(fullPath);
  if (
    stats.ctime.getTime() >=
    Date.now() - process.env.REVALIDATE_AFTER * 60 * 1000
  ) {
    logger.debug(
      `Don't have to check ${chalk.bold(
        fullPath
      )} for changes (Creation date: ${chalk.bold(
        stats.ctime.toLocaleString("de-DE")
      )} is not older than ${chalk.bold(process.env.REVALIDATE_AFTER)} minutes)`
    );
    return;
  }

  let newMtime = stats.mtime;
  logger.debug(
    `Checking ${chalk.bold(
      fullPath
    )} if it was modified since last download at ${chalk.bold(
      stats.ctime.toLocaleTimeString("de-DE")
    )} (Last modified date: ${chalk.bold(stats.mtime.toLocaleString("de-DE"))})`
  );

  try {
    const lastModifiedHeader = stats.mtime.toUTCString();
    const response = await axios.get(url, {
      timeout: process.env.TIMEOUT * 1000,
      maxRedirects: process.env.MAX_REDIRECTS,
      maxContentLength: process.env.MAX_SIZE * 1024 * 1024,
      headers: {
        "If-Modified-Since": lastModifiedHeader,
      },
      responseType: "arraybuffer",
      validateStatus: function (status) {
        return status < 300 || status == 304;
      },
    });

    if (response.status === 304) {
      logger.debug(`The image hasn't changed! Nothing to do.`);
    } else {
      logger.debug(`The image has changed ... updating!`);
      await updateCachedImages(path);
      newMtime = new Date(response.headers["last-modified"]);
    }
  } catch (error) {
    logger.error(
      `Failed to check ${chalk.bold(fullPath)} for changes: ${error.message}`
    );
  }

  await fs.utimes(fullPath, Date.now(), newMtime);
}
