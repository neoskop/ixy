import chalk from "chalk";
import axios from "axios";
import { measured } from "../util/measured.js";

export async function downloadSourceImage(url) {
  return await measured(async () => {
    const response = await axios.get(url, {
      timeout: 15000,
      maxContentLength: process.env.MAX_SIZE * 1024 * 1024,
      maxRedirects: 5,
      responseType: "arraybuffer",
    });
    return {
      lastModified: response.headers["last-modified"],
      arrayBuffer: response.data,
    };
  }, `Fetched source image from ${chalk.bold(url)}`);
}
