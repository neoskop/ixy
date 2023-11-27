import { loadFileFromCache } from "../cache/load-file-from-cache.js";
import { storeFileInCache } from "../cache/store-file-in-cache.js";
import { downloadSourceImage } from "../source/download-source-image.js";

export const fetchSourceImage = async (path, loadFromCache = true) => {
  const url = `${process.env.BASE_URL}${path}`;
  let arrayBuffer = loadFromCache ? await loadFileFromCache("src", path) : null;

  if (arrayBuffer) {
    return arrayBuffer;
  } else {
    let lastModified;
    ({ lastModified, arrayBuffer } = await downloadSourceImage(url));
    await storeFileInCache("src", path, arrayBuffer, lastModified);
  }

  return arrayBuffer;
};
