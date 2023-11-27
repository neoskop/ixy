import { logger } from "../util/logger.js";
import { BadRequestException } from "../error/bad-request-exception.js";
import { NotFoundException } from "../error/not-found-exception.js";
import { fetchSourceImage } from "../fetch/fetch-source-image.js";
import { fetchExistingTargetImage } from "../fetch/fetch-existing-target-image.js";
import { resizeImage } from "./resize-image.js";
import { updateInBackground } from "../cache/update-in-background.js";

const MAX_IMAGE_DIMENSION = 5000;

export function getParams(request) {
  const urlRegex = /\/(?<width>\d{1,4})\/(?<height>\d{1,4})(?<path>\/(.+))/;
  const {
    groups: { width, height, path },
  } = request.url.match(urlRegex) || {
    groups: { width: null, height: null, path: null },
  };

  const parsedWidth = parseInt(width) || undefined;
  const parsedHeight = parseInt(height) || undefined;

  if (isNaN(parsedWidth) || isNaN(parsedHeight) || !path) {
    throw new BadRequestException(
      "Width or height is not a number or path is missing."
    );
  }

  if (
    (parsedWidth && parsedWidth > MAX_IMAGE_DIMENSION) ||
    (parsedHeight && parsedHeight > MAX_IMAGE_DIMENSION)
  ) {
    throw new BadRequestException(
      `Width and height must not exceed ${MAX_IMAGE_DIMENSION} pixels.`
    );
  }

  return {
    parsedWidth,
    parsedHeight,
    path,
  };
}

export async function resizeRequestHandler(request, reply) {
  try {
    const { parsedWidth, parsedHeight, path } = getParams(request);
    let resizedImage = await fetchExistingTargetImage(
      path,
      parsedWidth,
      parsedHeight
    );

    if (!resizedImage) {
      const image = await fetchSourceImage(path);
      resizedImage = await resizeImage(path, image, parsedWidth, parsedHeight);
    } else {
      updateInBackground(path);
    }

    reply.header("Content-Type", "image/webp");
    reply.header("Cache-Control", `public, max-age=${60 * 60 * 24 * 365}`);
    return reply.send(resizedImage);
  } catch (err) {
    if (err.name === "AbortError") {
      logger.error(`Request for ${chalk.bold(path)} timed out`);
      return reply.code(504).send("Request timed out");
    } else if (err instanceof BadRequestException) {
      return reply.code(400).send(err.message);
    } else if (err instanceof NotFoundException) {
      return reply.code(404).send(err.message);
    } else {
      logger.error(err.message);
      reply.status(500).send("Internal Server Error");
    }
  }
}
