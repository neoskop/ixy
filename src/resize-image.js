import sharp from "sharp";
import { measured } from "./util/measured.js";
import { storeFileInCache } from "./cache/store-file-in-cache.js";
import { canonicalizeFileName } from "./cache/canonicalize-filename.js";

export async function resizeImage(path, image, targetWidth, targetHeight) {
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
    `Resized image`
  );
  await storeFileInCache(
    `target/${canonicalizeFileName(path)}`,
    `${targetWidth}-${targetHeight}.webp`,
    arrayBuffer
  );
  return arrayBuffer;
}
