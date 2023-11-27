import chalk from "chalk";
import axios from "axios";
import { measured } from "../util/measured.js";
import { NotFoundException } from "../error/not-found-exception.js";

export async function downloadSourceImage(url) {
  try {
    return await measured(async () => {
      const response = await axios.get(url, {
        timeout: process.env.TIMEOUT * 1000,
        maxContentLength: process.env.MAX_SIZE * 1024 * 1024,
        maxRedirects: process.env.MAX_REDIRECTS,
        responseType: "arraybuffer",
      });
      return {
        lastModified: response.headers["last-modified"],
        arrayBuffer: response.data,
      };
    }, `Fetched source image from ${chalk.bold(url)}`);
  } catch (err) {
    if (err.response?.status === 404) {
      throw new NotFoundException(`Source image not found`);
    } else {
      throw err;
    }
  }
}
