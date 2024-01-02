import { Logger } from '@nestjs/common';
import chalk from 'chalk';

export async function measured<T>(
  operation: () => T | Promise<T>,
  message: string,
) {
  const startTime = performance.now();
  const result = await operation();
  const endTime = performance.now();
  const elapsedTime = Math.floor(endTime - startTime);
  const formattedElapsedTime = chalk.yellow(`${elapsedTime} ms`);
  Logger.debug(`${message} in ${formattedElapsedTime}`);
  return result;
}
