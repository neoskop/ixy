import { loadFileFromCache } from "../cache/load-file-from-cache.js";
import { canonicalizeFileName } from "../cache/canonicalize-filename.js";

export const fetchExistingTargetImage = async (
  path,
  parsedWidth,
  parsedHeight
) => {
  const arrayBuffer = await loadFileFromCache(
    `target/${canonicalizeFileName(path)}`,
    `${parsedWidth}-${parsedHeight}.webp`,
    async () => null
  );

  if (arrayBuffer) {
    return Buffer.from(arrayBuffer);
  }
};
