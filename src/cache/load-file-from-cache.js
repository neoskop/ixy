import chalk from "chalk";
import fs from "fs/promises";
import { canonicalizeFileName } from "./canonicalize-filename.js";
import { measured } from "../util/measured.js";

export async function loadFileFromCache(directory, fileName) {
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
      `Loaded cached image from ${chalk.bold(fullPath)}`
    );
    return fileContent.buffer;
  }
}
