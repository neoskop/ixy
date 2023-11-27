import { canonicalizeFileName } from "./canonicalize-filename.js";
import { resizeImage } from "../resize/resize-image.js";
import glob from "fast-glob";
import { logger } from "../util/logger.js";
import { eachLimit } from "async";
import chalk from "chalk";

export async function updateTargetImages(path, sourceImageArrayBuffer) {
  const targetPath = `${process.env.CACHE_DIR}/target/${canonicalizeFileName(
    path
  )}/*.webp`;
  const imageFiles = await glob(targetPath);

  await eachLimit(imageFiles, 5, async (imageFile) => {
    const targetWidth = parseInt(imageFile.match(/\/(\d+)-\d+\.webp$/)[1]);
    const targetHeight = parseInt(imageFile.match(/\/\d+-(\d+)\.webp$/)[1]);
    await resizeImage(path, sourceImageArrayBuffer, targetWidth, targetHeight);
    logger.info(`Updated target image ${chalk.bold(imageFile)}`);
  });
}
