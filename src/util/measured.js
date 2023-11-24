import chalk from "chalk";
import { logger } from "./logger.js";

export async function measured(operation, message) {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();
  const elapsedTime = Math.floor(endTime - startTime);
  const formattedElapsedTime = chalk.yellow(`${elapsedTime} ms`);
  logger.debug(`${message} in ${formattedElapsedTime}`);
  return result;
}
